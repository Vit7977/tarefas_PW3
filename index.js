import express from 'express';
import cors from 'cors';
import * as Service from './service/service.js';

const app = express();
app.use(express.json());
app.use(cors());

app.get('/',(req,res)=>{
    res.status(200).json("{'result':'ok'}");
})

// Usuários
app.get('/usuarios', Service.consultarUsuarios);
app.get('/usuarios/:id', Service.consultarUsuarioPorId);
app.get('/usuarios/:id/tarefas', Service.consultarTarefasDoUsuario);
app.post('/usuarios', Service.cadastrarUsuario);
app.put('/usuarios/:id', Service.atualizarUsuario);
app.delete('/usuarios/:id', Service.deletarUsuario);

// Tarefas
app.get('/tarefas', Service.consultarTarefas);
app.get('/tarefas/:id', Service.consultarTarefaPorId);
app.post('/tarefas', Service.cadastrarTarefa);
app.put('/tarefas/:id', Service.atualizarTarefa);
app.delete('/tarefas/:id', Service.deletarTarefa);

// Nos testes (vitest) o servidor não é iniciado, o supertest usa o app direto
if (!process.env.VITEST) {
    app.listen(3000,()=>{
        let data = new Date();
        console.log(`Sistema inicializado: \nInf:${data}`);
        console.log('http://localhost:3000/');
    })
}

export default app;
