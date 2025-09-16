// routes/notas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/notas/turma/:id -> ROTA OTIMIZADA E CORRIGIDA
router.get('/turma/:id', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id: id_turma } = req.params;
    try {
        // Passo 1: Busca todos os alunos da turma
        const [alunos] = await pool.query(
            `SELECT u.id_usuario, u.nome FROM usuarios u
             JOIN alunos_turmas at ON u.id_usuario = at.id_aluno
             WHERE at.id_turma = ? ORDER BY u.nome`, [id_turma]
        );

        // Se não houver alunos, retorna uma lista vazia
        if (alunos.length === 0) {
            return res.json([]);
        }

        // Passo 2: Busca TODAS as avaliações da turma de uma só vez
        const [avaliacoes] = await pool.query(
            'SELECT * FROM avaliacoes WHERE id_turma = ?', [id_turma]
        );

        // Passo 3: Organiza as avaliações por aluno para fácil acesso
        const avaliacoesPorAluno = avaliacoes.reduce((acc, aval) => {
            if (!acc[aval.id_aluno]) {
                acc[aval.id_aluno] = [];
            }
            acc[aval.id_aluno].push(aval);
            return acc;
        }, {});

        // Passo 4: Combina os dados e calcula a média
        const resultadoFinal = alunos.map(aluno => {
            const notasDoAluno = avaliacoesPorAluno[aluno.id_usuario] || [];
            const total = notasDoAluno.reduce((sum, aval) => sum + parseFloat(aval.nota), 0);
            const media = notasDoAluno.length > 0 ? (total / notasDoAluno.length) : null;

            return {
                ...aluno,
                avaliacoes: notasDoAluno,
                media_final: media
            };
        });

        res.json(resultadoFinal);
    } catch (err) {
        console.error("Erro detalhado ao buscar notas:", err); // Log de erro melhorado
        res.status(500).json({ error: 'Erro ao buscar notas da turma' });
    }
});

// POST /api/notas -> Adiciona uma nova nota para um aluno
router.post('/', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id_turma, id_aluno, descricao, nota } = req.body;
    try {
        if (!id_turma || !id_aluno || !descricao || !nota) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }
        const data_avaliacao = new Date().toISOString().slice(0, 10);
        
        const [result] = await pool.query(
            'INSERT INTO avaliacoes (id_aluno, id_turma, descricao, nota, data_avaliacao) VALUES (?, ?, ?, ?, ?)',
            [id_aluno, id_turma, descricao, nota, data_avaliacao]
        );
        
        res.status(201).json({ id_avaliacao: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar nota' });
    }
});

// GET /api/notas/me -> Atualizado para a nova tabela
router.get('/me', authenticateToken, authorizeRoles('aluno'), async (req, res) => {
    const id_aluno = req.user.id_usuario;
    try {
        const [rows] = await pool.query(
            `SELECT a.descricao, a.nota, a.data_avaliacao, t.nome as turma_nome
             FROM avaliacoes a
             JOIN turmas t ON a.id_turma = t.id_turma
             WHERE a.id_aluno = ? ORDER BY a.data_avaliacao DESC`,
            [id_aluno]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar notas.' });
    }
});

module.exports = router;