// routes/chamadas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/chamadas/turma/:id_turma/materia/:materia/data/:data -> Pega a chamada de um dia específico para uma materia
router.get('/turma/:id_turma/materia/:materia/data/:data', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id_turma, materia, data } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT id_aluno, status FROM chamadas WHERE id_turma = ? AND materia = ? AND data = ?',
            [id_turma, materia, data]
        );
        // Transforma o array em um objeto para fácil acesso no frontend: { id_aluno: status }
        const presencas = rows.reduce((acc, row) => {
            acc[row.id_aluno] = row.status;
            return acc;
        }, {});
        res.json(presencas);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar chamada' });
    }
});

// POST /api/chamadas -> Registra a chamada para uma turma em um dia
router.post('/', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id_turma, materia, data, presencas } = req.body;
    const id_professor = req.user.id_usuario;

    if (!id_turma || !materia || !data || !presencas) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const connection = await pool.getConnection();
    try {
        // Verifica se o professor está alocado na turma para a materia
        const [[assigned]] = await connection.query('SELECT 1 FROM professores_turmas WHERE id_professor=? AND id_turma=? AND materia=? LIMIT 1', [id_professor, id_turma, materia]);
        if (!assigned) {
            connection.release();
            return res.status(403).json({ error: 'Professor não alocado nesta turma ou matéria' });
        }

        await connection.beginTransaction();

        // Apaga a chamada antiga para este dia, turma e materia (garante que podemos salvar novamente)
        await connection.query('DELETE FROM chamadas WHERE id_turma = ? AND materia = ? AND data = ?', [id_turma, materia, data]);

        // Insere os novos registros de presença
        const inserts = Object.entries(presencas).map(([id_aluno, status]) => {
            return connection.query('INSERT INTO chamadas (id_aluno, id_turma, materia, data, status) VALUES (?, ?, ?, ?, ?)', [id_aluno, id_turma, materia, data, status]);
        });
        await Promise.all(inserts);

        await connection.commit();
        res.status(201).json({ message: 'Chamada registrada com sucesso!' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Erro ao registrar chamada' });
    } finally {
        connection.release();
    }
});

// GET /api/chamadas/me -> Aluno busca seu histórico de presença
router.get('/me', authenticateToken, authorizeRoles('aluno'), async (req, res) => {
    const id_aluno = req.user.id_usuario;
    // --- INÍCIO DO LOG DE DIAGNÓSTICO ---
    console.log("DEBUG: GET /api/chamadas/me");
    console.log("DEBUG: ID do Aluno (JWT):", id_aluno); 
    // --- FIM DO LOG DE DIAGNÓSTICO ---
    try {
        const [rows] = await pool.query(
            `SELECT materia, data, status FROM chamadas WHERE id_aluno = ? ORDER BY data DESC`,
            [id_aluno]
        );
        // --- INÍCIO DO LOG DE DIAGNÓSTICO ---
        console.log("DEBUG: Query Executada com sucesso.");
        console.log("DEBUG: Linhas Recebidas do DB:", rows.length);
        console.log("DEBUG: Conteúdo da 1ª Linha (Se existir):", rows.length > 0 ? rows[0] : 'Vazio');
        // --- FIM DO LOG DE DIAGNÓSTICO ---
        res.json(rows);
    } catch (err) {
        console.error(err);
        console.error("Erro no DB ao buscar chamadas/me:", err);
        res.status(500).json({ error: 'Erro ao buscar histórico de presença.' });
    }
});

module.exports = router;