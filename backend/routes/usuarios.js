// routes/usuarios.js
const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/usuarios  (admin)
router.get('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const [rows] = await pool.query('SELECT id_usuario, nome, email, perfil FROM usuarios');
  res.json(rows);
});

// POST /api/usuarios  (admin) - criar usuario (professor/aluno/admin)
router.post('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const { nome, email, senha, perfil } = req.body;
  if (!nome || !email || !senha || !perfil) return res.status(400).json({ error: 'Dados incompletos' });
  try {
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await pool.query('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)', [nome, email, hash, perfil]);
    res.status(201).json({ id_usuario: result.insertId, nome, email, perfil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// PUT /api/usuarios/:id  (admin)
router.put('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const id = req.params.id;
  const { nome, email, senha, perfil } = req.body;
  try {
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      await pool.query('UPDATE usuarios SET nome=?, email=?, senha=?, perfil=? WHERE id_usuario=?', [nome, email, hash, perfil, id]);
    } else {
      await pool.query('UPDATE usuarios SET nome=?, email=?, perfil=? WHERE id_usuario=?', [nome, email, perfil, id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

// DELETE /api/usuarios/:id (admin)
router.delete('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
  res.json({ ok: true });
});

module.exports = router;
