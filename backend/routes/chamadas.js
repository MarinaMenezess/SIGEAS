// routes/turmas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/turmas  (admin, professor, aluno) -> lista turmas (filtra por professor/aluno se necessário)
router.get('/', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    if (user.perfil === 'administrador') {
      const [rows] = await pool.query('SELECT * FROM turmas');
      return res.json(rows);
    }
    if (user.perfil === 'professor') {
      const [rows] = await pool.query(
        `SELECT t.* FROM turmas t
         JOIN professores_turmas pt ON pt.id_turma=t.id_turma
         WHERE pt.id_professor = ?`, [user.id_usuario]);
      return res.json(rows);
    }
    if (user.perfil === 'aluno') {
      const [rows] = await pool.query(
        `SELECT t.* FROM turmas t
         JOIN alunos_turmas at ON at.id_turma=t.id_turma
         WHERE at.id_aluno = ?`, [user.id_usuario]);
      return res.json(rows);
    }
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro' });
  }
});

// POST /api/turmas  (admin) - criar
router.post('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const { nome, descricao, ano } = req.body;
  const [r] = await pool.query('INSERT INTO turmas (nome, descricao, ano) VALUES (?, ?, ?)', [nome, descricao, ano]);
  res.status(201).json({ id_turma: r.insertId, nome, descricao, ano });
});

// GET /api/turmas/:id/alunos  (admin, professor assigned)
router.get('/:id/alunos', authenticateToken, async (req, res) => {
  const id_turma = req.params.id;
  const user = req.user;

  // admin allowed always; professor only if assigned; student only if enrolled
  try {
    if (user.perfil === 'professor') {
      const [[assigned]] = await pool.query('SELECT 1 FROM professores_turmas WHERE id_professor=? AND id_turma=? LIMIT 1', [user.id_usuario, id_turma]);
      if (!assigned) return res.status(403).json({ error: 'Professor não alocado nesta turma' });
    }
    if (user.perfil === 'aluno') {
      const [[mat]] = await pool.query('SELECT 1 FROM alunos_turmas WHERE id_aluno=? AND id_turma=? LIMIT 1', [user.id_usuario, id_turma]);
      if (!mat) return res.status(403).json({ error: 'Aluno não matriculado' });
    }

    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, at.data_matricula
       FROM usuarios u
       JOIN alunos_turmas at ON at.id_aluno = u.id_usuario
       WHERE at.id_turma = ?`, [id_turma]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro' });
  }
});

// POST /api/turmas/:id/matricular  (admin)
router.post('/:id/matricular', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const id_turma = req.params.id;
  const { id_aluno, data_matricula } = req.body;
  await pool.query('INSERT INTO alunos_turmas (id_aluno, id_turma, data_matricula) VALUES (?, ?, ?)', [id_aluno, id_turma, data_matricula || new Date()]);
  res.json({ ok: true });
});

// POST /api/turmas/:id/professor  (admin) - associar professor
router.post('/:id/professor', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const id_turma = req.params.id;
  const { id_professor } = req.body;
  await pool.query('INSERT INTO professores_turmas (id_professor, id_turma) VALUES (?, ?)', [id_professor, id_turma]);
  res.json({ ok: true });
});

// PUT /api/turmas/:id  (admin)
router.put('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const id = req.params.id;
  const { nome, descricao, ano } = req.body;
  await pool.query('UPDATE turmas SET nome=?, descricao=?, ano=? WHERE id_turma=?', [nome, descricao, ano, id]);
  res.json({ ok: true });
});

// DELETE /api/turmas/:id (admin)
router.delete('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM turmas WHERE id_turma=?', [id]);
  res.json({ ok: true });
});

module.exports = router;
