import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

// Estes testes cobrem as validações, que respondem antes de qualquer acesso ao banco

describe('API de Tarefas', () => {
    it('POST /usuarios com dados inválidos deve retornar 400', async () => {
        const res = await request(app)
            .post('/usuarios')
            .send({ email: 'email-invalido', nome: '', senha: '123' });

        expect(res.status).toBe(400);
        expect(res.body.erro).toContain('email inválido');
        expect(res.body.erro).toContain('nome é obrigatório (máx. 100 caracteres)');
        expect(res.body.erro).toContain('senha deve ter no mínimo 6 caracteres');
    });

    it('GET /tarefas/:id com ID não numérico deve retornar 400', async () => {
        const res = await request(app).get('/tarefas/abc');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ erro: 'ID inválido' });
    });

    it('POST /tarefas com status inválido deve retornar 400', async () => {
        const res = await request(app)
            .post('/tarefas')
            .send({ fk_usuario_id: 1, titulo: 'Estudar', status: 'ATRASADA' });

        expect(res.status).toBe(400);
        expect(res.body.erro).toContain('status deve ser PENDENTE ou CONCLUIDA');
    });
});
