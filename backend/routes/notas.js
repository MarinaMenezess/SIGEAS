// routes/notas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// POST /api/notas  (professor assigned) body: { id_turma, id_aluno, nota1, nota2 }
router.post('/', authenticateToken, authorizeRoles('professor'), async (req, res) => {
  const { id_turma, id_aluno, nota1, nota2 } = req.body;
  const user = req.user;
  try {
    // verifica professor alocado
    const [[assigned]] = await pool.query('SELECT 1 FROM professores_turmas WHERE id_professor=? AND id_turma=? LIMIT 1', [user.id_usuario, id_turma]);
    if (!assigned) return res.status(403).json({ error: 'Professor não alocado' });

    const media = ( (Number(nota1) || 0) + (Number(nota2) || 0) ) / ( (nota1 ? 1 : 0) + (nota2 ? 1 : 0) ) || null;

    // upsert: se existir, update; se não, insert
    const [exists] = await pool.query('SELECT id_nota FROM notas WHERE id_turma=? AND id_aluno=?', [id_turma, id_aluno]);
    if (exists.length) {
      await pool.query('UPDATE notas SET nota1=?, nota2=?, media_final=? WHERE id_nota=?', [nota1, nota2, media, exists[0].id_nota]);
    } else {
      await pool.query('INSERT INTO notas (id_aluno, id_turma, nota1, nota2, media_final) VALUES (?, ?, ?, ?, ?)', [id_aluno, id_turma, nota1, nota2, media]);
    }

    res.json({ ok: true, media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /api/notas/turma/:id  (professor or aluno/admin)
router.get('/turma/:id', authenticateToken, async (req, res) => {
  const id_turma = req.params.id;
  const user = req.user;
  try {
    if (user.perfil === 'professor') {
      const [[assigned]] = await pool.query('SELECT 1 FROM professores_turmas WHERE id_professor=? AND id_turma=? LIMIT 1', [user.id_usuario, id_turma]);
      if (!assigned) return res.status(403).json({ error: 'Professor não alocado' });
    }
    if (user.perfil === 'aluno') {
      const [[mat]] = await pool.query('SELECT 1 FROM alunos_turmas WHERE id_aluno=? AND id_turma=? LIMIT 1', [user.id_usuario, id_turma]);
      if (!mat) return res.status(403).json({ error: 'Aluno não matriculado' });
    }

    const [rows] = await pool.query(
      `SELECT n.id_nota, n.id_aluno, u.nome, n.nota1, n.nota2, n.media_final
       FROM notas n
       JOIN usuarios u ON u.id_usuario = n.id_aluno
       WHERE n.id_turma = ?`, [id_turma]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /api/notas/me  (aluno vê suas notas)
router.get('/me', authenticateToken, authorizeRoles('aluno'), async (req, res) => {
  const id_aluno = req.user.id_usuario;
  const [rows] = await pool.query(
    `SELECT n.id_nota, n.id_turma, t.nome as turma_nome, n.nota1, n.nota2, n.media_final
     FROM notas n
     JOIN turmas t ON t.id_turma = n.id_turma
     WHERE n.id_aluno = ?`, [id_aluno]);
  res.json(rows);
});

module.exports = router;
