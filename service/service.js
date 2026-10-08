import mysql from 'mysql2/promise';
import crypto from 'crypto';

// ================== CONEXÃO COM O BANCO ==================

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'tarefas',
    password: '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 10
});

// Executa um comando SQL pegando e liberando a conexão do pool
const executar = async (cmdSql, valores = []) => {
    const cx = await pool.getConnection();
    try {
        const [dados, meta_dados] = await cx.query(cmdSql, valores);
        return dados;
    } finally {
        cx.release();
    }
};

// ================== FUNÇÕES AUXILIARES ==================

const STATUS_VALIDOS = ['PENDENTE', 'CONCLUIDA'];
const CAMPOS_USUARIO = 'id, email, nome, created_at, updated_at'; // nunca devolve a senha

const idValido = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;
const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const textoValido = (txt, max) => typeof txt === 'string' && txt.trim().length > 0 && txt.trim().length <= max;
const dataValida = (data) => !isNaN(new Date(data).getTime());

const gerarHashSenha = (senha) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

const erroInterno = (res, msg, error) => {
    console.error(msg, error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
};

// Valida os dados do usuário. Em "parcial" (PUT) os campos são opcionais
const validarUsuario = ({ email, nome, senha }, parcial = false) => {
    const erros = [];
    if (!parcial || email !== undefined) {
        if (!textoValido(email, 100) || !emailValido(email)) erros.push('email inválido');
    }
    if (!parcial || nome !== undefined) {
        if (!textoValido(nome, 100)) erros.push('nome é obrigatório (máx. 100 caracteres)');
    }
    if (!parcial || senha !== undefined) {
        if (typeof senha !== 'string' || senha.length < 6) erros.push('senha deve ter no mínimo 6 caracteres');
    }
    return erros;
};

// Valida os dados da tarefa. Em "parcial" (PUT) os campos são opcionais
const validarTarefa = ({ fk_usuario_id, titulo, descricao, data, status }, parcial = false) => {
    const erros = [];
    if (!parcial || fk_usuario_id !== undefined) {
        if (!idValido(fk_usuario_id)) erros.push('fk_usuario_id inválido');
    }
    if (!parcial || titulo !== undefined) {
        if (!textoValido(titulo, 100)) erros.push('titulo é obrigatório (máx. 100 caracteres)');
    }
    if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
        erros.push('descricao deve ser texto');
    }
    if (data !== undefined && data !== null && !dataValida(data)) {
        erros.push('data inválida');
    }
    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
        erros.push(`status deve ser ${STATUS_VALIDOS.join(' ou ')}`);
    }
    return erros;
};

const usuarioExiste = async (id) => {
    const dados = await executar('SELECT id FROM usuarios WHERE id = ?', [id]);
    return dados.length > 0;
};

// ================== USUÁRIOS ==================

export const consultarUsuarios = async (req, res) => {
    try {
        const nome = req.query.nome || '';
        const result = await executar(
            `SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE nome LIKE ?`,
            [`%${nome}%`]
        );
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ erro: 'Nenhum recurso encontrado' });
        }
    } catch (error) {
        erroInterno(res, 'Erro ao consultar usuários:', error);
    }
};

export const consultarUsuarioPorId = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }
        const result = await executar(`SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE id = ?`, [id]);
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ erro: 'Recurso não encontrado' });
        }
    } catch (error) {
        erroInterno(res, 'Erro ao consultar usuário por ID:', error);
    }
};

export const cadastrarUsuario = async (req, res) => {
    try {
        const { email, nome, senha } = req.body;
        const erros = validarUsuario({ email, nome, senha });
        if (erros.length > 0) {
            return res.status(400).json({ erro: erros });
        }

        const existe = await executar('SELECT id FROM usuarios WHERE email = ?', [email.trim()]);
        if (existe.length > 0) {
            return res.status(409).json({ erro: 'Email já cadastrado' });
        }

        const result = await executar(
            'INSERT INTO usuarios(email, nome, senha) VALUES (?, ?, ?)',
            [email.trim(), nome.trim(), gerarHashSenha(senha)]
        );
        const novoUsuario = await executar(`SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE id = ?`, [result.insertId]);
        res.status(201).json(novoUsuario);
    } catch (error) {
        erroInterno(res, 'Erro ao cadastrar usuário:', error);
    }
};

export const atualizarUsuario = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        const { email, nome, senha } = req.body;
        if (email === undefined && nome === undefined && senha === undefined) {
            return res.status(400).json({ erro: 'Informe ao menos um campo: email, nome ou senha' });
        }
        const erros = validarUsuario({ email, nome, senha }, true);
        if (erros.length > 0) {
            return res.status(400).json({ erro: erros });
        }

        if (!(await usuarioExiste(id))) {
            return res.status(404).json({ erro: 'Recurso não encontrado' });
        }

        if (email !== undefined) {
            const existe = await executar('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email.trim(), id]);
            if (existe.length > 0) {
                return res.status(409).json({ erro: 'Email já cadastrado' });
            }
        }

        const campos = [];
        const valores = [];
        if (email !== undefined) { campos.push('email = ?'); valores.push(email.trim()); }
        if (nome !== undefined) { campos.push('nome = ?'); valores.push(nome.trim()); }
        if (senha !== undefined) { campos.push('senha = ?'); valores.push(gerarHashSenha(senha)); }

        await executar(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, [...valores, id]);
        const usuario = await executar(`SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE id = ?`, [id]);
        res.status(200).json(usuario);
    } catch (error) {
        erroInterno(res, 'Erro ao atualizar usuário:', error);
    }
};

export const deletarUsuario = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }
        if (!(await usuarioExiste(id))) {
            return res.status(404).json({ erro: 'Recurso não encontrado' });
        }

        const tarefas = await executar('SELECT id FROM tarefas WHERE fk_usuario_id = ? LIMIT 1', [id]);
        if (tarefas.length > 0) {
            return res.status(409).json({ erro: 'Usuário possui tarefas cadastradas e não pode ser removido' });
        }

        await executar('DELETE FROM usuarios WHERE id = ?', [id]);
        res.status(204).send();
    } catch (error) {
        erroInterno(res, 'Erro ao deletar usuário:', error);
    }
};

// ================== TAREFAS ==================

export const consultarTarefas = async (req, res) => {
    try {
        const { titulo, status, usuario } = req.query;

        if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
            return res.status(400).json({ erro: `status deve ser ${STATUS_VALIDOS.join(' ou ')}` });
        }
        if (usuario !== undefined && !idValido(usuario)) {
            return res.status(400).json({ erro: 'usuario inválido' });
        }

        let cmdSql = 'SELECT * FROM tarefas WHERE titulo LIKE ?';
        const valores = [`%${titulo || ''}%`];
        if (status) { cmdSql += ' AND status = ?'; valores.push(status); }
        if (usuario) { cmdSql += ' AND fk_usuario_id = ?'; valores.push(usuario); }

        const result = await executar(cmdSql, valores);
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ erro: 'Nenhum recurso encontrado' });
        }
    } catch (error) {
        erroInterno(res, 'Erro ao consultar tarefas:', error);
    }
};

export const consultarTarefaPorId = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }
        const result = await executar('SELECT * FROM tarefas WHERE id = ?', [id]);
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ erro: 'Recurso não encontrado' });
        }
    } catch (error) {
        erroInterno(res, 'Erro ao consultar tarefa por ID:', error);
    }
};

export const consultarTarefasDoUsuario = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }
        if (!(await usuarioExiste(id))) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        const result = await executar('SELECT * FROM tarefas WHERE fk_usuario_id = ?', [id]);
        if (result.length > 0) {
            res.status(200).json(result);
        } else {
            res.status(404).json({ erro: 'Nenhum recurso encontrado' });
        }
    } catch (error) {
        erroInterno(res, 'Erro ao consultar tarefas do usuário:', error);
    }
};

export const cadastrarTarefa = async (req, res) => {
    try {
        const { fk_usuario_id, titulo, descricao, data, status } = req.body;
        const erros = validarTarefa({ fk_usuario_id, titulo, descricao, data, status });
        if (erros.length > 0) {
            return res.status(400).json({ erro: erros });
        }

        if (!(await usuarioExiste(fk_usuario_id))) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        const result = await executar(
            'INSERT INTO tarefas(fk_usuario_id, titulo, descricao, `data`, `status`) VALUES (?, ?, ?, ?, ?)',
            [fk_usuario_id, titulo.trim(), descricao ?? null, data ? new Date(data) : null, status || 'PENDENTE']
        );
        const novaTarefa = await executar('SELECT * FROM tarefas WHERE id = ?', [result.insertId]);
        res.status(201).json(novaTarefa);
    } catch (error) {
        erroInterno(res, 'Erro ao cadastrar tarefa:', error);
    }
};

export const atualizarTarefa = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }

        const { fk_usuario_id, titulo, descricao, data, status } = req.body;
        if ([fk_usuario_id, titulo, descricao, data, status].every(c => c === undefined)) {
            return res.status(400).json({ erro: 'Informe ao menos um campo para atualizar' });
        }
        const erros = validarTarefa({ fk_usuario_id, titulo, descricao, data, status }, true);
        if (erros.length > 0) {
            return res.status(400).json({ erro: erros });
        }

        const existe = await executar('SELECT id FROM tarefas WHERE id = ?', [id]);
        if (existe.length === 0) {
            return res.status(404).json({ erro: 'Recurso não encontrado' });
        }
        if (fk_usuario_id !== undefined && !(await usuarioExiste(fk_usuario_id))) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }

        const campos = [];
        const valores = [];
        if (fk_usuario_id !== undefined) { campos.push('fk_usuario_id = ?'); valores.push(fk_usuario_id); }
        if (titulo !== undefined) { campos.push('titulo = ?'); valores.push(titulo.trim()); }
        if (descricao !== undefined) { campos.push('descricao = ?'); valores.push(descricao); }
        if (data !== undefined) { campos.push('`data` = ?'); valores.push(data ? new Date(data) : null); }
        if (status !== undefined) { campos.push('`status` = ?'); valores.push(status); }

        await executar(`UPDATE tarefas SET ${campos.join(', ')} WHERE id = ?`, [...valores, id]);
        const tarefa = await executar('SELECT * FROM tarefas WHERE id = ?', [id]);
        res.status(200).json(tarefa);
    } catch (error) {
        erroInterno(res, 'Erro ao atualizar tarefa:', error);
    }
};

export const deletarTarefa = async (req, res) => {
    try {
        const id = req.params.id;
        if (!idValido(id)) {
            return res.status(400).json({ erro: 'ID inválido' });
        }
        const result = await executar('DELETE FROM tarefas WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ erro: 'Recurso não encontrado' });
        }
    } catch (error) {
        erroInterno(res, 'Erro ao deletar tarefa:', error);
    }
};
