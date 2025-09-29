// routes/notas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/notas/turma/:id/materia/:materia -> Busca notas de todos os alunos de uma turma e materia
router.get('/turma/:id/materia/:materia', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id: id_turma, materia } = req.params;
    try {
        const [alunos] = await pool.query(
            `SELECT u.id_usuario, u.nome FROM usuarios u
             JOIN alunos_turmas at ON u.id_usuario = at.id_aluno
             WHERE at.id_turma = ? ORDER BY u.nome`, [id_turma]
        );

        if (alunos.length === 0) {
            return res.json([]);
        }

        const [avaliacoes] = await pool.query(
            'SELECT * FROM avaliacoes WHERE id_turma = ? AND materia = ?', [id_turma, materia]
        );

        const avaliacoesPorAluno = avaliacoes.reduce((acc, aval) => {
            if (!acc[aval.id_aluno]) {
                acc[aval.id_aluno] = [];
            }
            acc[aval.id_aluno].push(aval);
            return acc;
        }, {});

        const resultadoFinal = alunos.map(aluno => {
            const notasDoAluno = avaliacoesPorAluno[aluno.id_usuario] || [];
            
            const notasPorTrimestre = notasDoAluno.reduce((acc, aval) => {
                const trimestre = aval.trimestre;
                if (!acc[trimestre]) {
                    acc[trimestre] = [];
                }
                acc[trimestre].push(parseFloat(aval.nota));
                return acc;
            }, {});

            let mediasTrimestrais = [];
            for (const trimestre in notasPorTrimestre) {
                const notas = notasPorTrimestre[trimestre];
                const mediaTrimestre = notas.reduce((sum, nota) => sum + nota, 0) / notas.length;
                mediasTrimestrais.push(mediaTrimestre);
            }

            const mediaFinal = mediasTrimestrais.length > 0
                ? mediasTrimestrais.reduce((sum, media) => sum + media, 0) / mediasTrimestrais.length
                : null;

            return {
                ...aluno,
                avaliacoes: notasDoAluno,
                media_final: mediaFinal
            };
        });

        res.json(resultadoFinal);
    } catch (err) {
        console.error("Erro detalhado ao buscar notas:", err);
        res.status(500).json({ error: 'Erro ao buscar notas da turma' });
    }
});

// POST /api/notas/lancar-em-lote -> Adiciona uma nova nota para todos os alunos de uma turma e materia
router.post('/lancar-em-lote', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    // Renomeia 'trimestre' para 'trimestreString' na desestruturação
    const { id_turma, materia, descricao, trimestre: trimestreString, notas } = req.body;
    
    // CORREÇÃO: Converte a string do trimestre para um número inteiro
    const trimestre = parseInt(trimestreString);
    
    if (!id_turma || !materia || !descricao || isNaN(trimestre) || !notas || notas.length === 0) {
        return res.status(400).json({ error: 'Dados incompletos para o lançamento de notas.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const data_avaliacao = new Date().toISOString().slice(0, 10);
        
        for (const notaAluno of notas) {
            await connection.query(
                'INSERT INTO avaliacoes (id_aluno, id_turma, materia, descricao, nota, trimestre, data_avaliacao) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [notaAluno.id_aluno, id_turma, materia, descricao, notaAluno.nota, trimestre, data_avaliacao]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Notas lançadas com sucesso!' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ error: 'Erro ao lançar notas.' });
    } finally {
        connection.release();
    }
});

// DELETE /api/notas/:id -> Exclui uma avaliação específica
router.delete('/:id', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id: id_avaliacao } = req.params;
    try {
        await pool.query('DELETE FROM avaliacoes WHERE id_avaliacao = ?', [id_avaliacao]);
        res.status(200).json({ message: 'Avaliação excluída com sucesso.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir avaliação.' });
    }
});

// GET /api/notas/me -> Aluno busca suas notas
router.get('/me', authenticateToken, authorizeRoles('aluno'), async (req, res) => {
    const id_aluno = req.user.id_usuario;
    try {
        const [rows] = await pool.query(
            `SELECT a.materia, a.descricao, a.nota, a.data_avaliacao, a.trimestre, t.nome as turma_nome
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