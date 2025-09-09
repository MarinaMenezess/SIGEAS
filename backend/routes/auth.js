// routes/auth.js
const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { usernameOrEmail, senha } = req.body;
  if (!usernameOrEmail || !senha) return res.status(400).json({ error: 'Dados incompletos' });

  try {
    // Busca usuário por email ou nome (ou adaptar para username)
    const [rows] = await pool.query(`SELECT id_usuario, nome, email, senha, perfil FROM usuarios WHERE email = ? OR nome = ? LIMIT 1`, [usernameOrEmail, usernameOrEmail]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const match = await bcrypt.compare(senha, user.senha);
    if (!match) return res.status(401).json({ error: 'Senha inválida' });

    const payload = { id_usuario: user.id_usuario, perfil: user.perfil, nome: user.nome, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;
