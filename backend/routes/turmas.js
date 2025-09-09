// routes/turmas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/turmas (para listar as turmas)
router.get('/', authenticateToken, async (req, res) => {
    const [rows] = await pool.query(`
        SELECT t.*, u.nome as professor_nome 
        FROM turmas t 
        LEFT JOIN professores_turmas pt ON t.id_turma = pt.id_turma 
        LEFT JOIN usuarios u ON pt.id_professor = u.id_usuario
    `);
    res.json(rows);
});

// POST /api/turmas (para criar turma)
router.post('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const { nome, descricao, ano, id_professor } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('INSERT INTO turmas (nome, descricao, ano) VALUES (?, ?, ?)', [nome, descricao, ano]);
    const idTurma = result.insertId;
    if (id_professor) {
      await connection.query('INSERT INTO professores_turmas (id_professor, id_turma) VALUES (?, ?)', [id_professor, idTurma]);
    }
    await connection.commit();
    res.status(201).json({ id_turma: idTurma });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Erro ao criar turma' });
  } finally {
    connection.release();
  }
});

// PUT /api/turmas/:id (para editar turma)
router.put('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const idTurma = req.params.id;
  const { nome, descricao, ano, id_professor } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE turmas SET nome=?, descricao=?, ano=? WHERE id_turma=?', [nome, descricao, ano, idTurma]);
    
    // Atualiza a associação do professor
    await connection.query('DELETE FROM professores_turmas WHERE id_turma = ?', [idTurma]);
    if (id_professor) {
      await connection.query('INSERT INTO professores_turmas (id_professor, id_turma) VALUES (?, ?)', [id_professor, idTurma]);
    }
    
    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Erro ao atualizar turma' });
  } finally {
    connection.release();
  }
});

// DELETE /api/turmas/:id (para excluir turma)
router.delete('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  await pool.query('DELETE FROM turmas WHERE id_turma=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;