import  pool  from '../data/index.js';

export const consultar = async (filtro = '') => {
    try {
        const cx = await pool.getConnection();
        const cmdSql = `SELECT * FROM empresa WHERE empresa.nome LIKE ?`;
        const [dados, meta_dados] = await cx.query(cmdSql, [`%${filtro}%`]);
        cx.release();
        return dados;
    } catch (error) {
        throw error;
    }
};

export const consultarPorId = async (id) => {
    try {
        const cx = await pool.getConnection();
        const cmdSql = 'SELECT * FROM empresa WHERE empresa.id = ?';
        const [dados, meta_dados] = await cx.query(cmdSql, [id]);
        cx.release();
        return dados;
    } catch (error) {
        throw error;
    }
};

export const cadastrar = async (Nome, ValorDeMercado) => {
    try {
        const cx = await pool.getConnection();
        // Inserir os dados na tabela empresa
        const cmdSql = 'INSERT INTO empresa(Nome, ValorDeMercado) VALUES (?, ?)';
        await cx.query(cmdSql, [Nome, ValorDeMercado]);

        // Recuperar o último ID inserido
        const [result] = await cx.query('SELECT LAST_INSERT_ID() as lastId');
        const lastId = result[0].lastId;

        // Consultar a empresa recém-cadastrada pelo último ID
        const [dados, meta_dados] = await cx.query('SELECT * FROM empresa WHERE id = ?', [lastId]);
        cx.release();
        return dados;
    } catch (error) {
        throw error;
    }
};

