// routes/usuarios.js
const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/usuarios (ATUALIZADO para incluir a turma do aluno)
router.get('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
    const [rows] = await pool.query(`
        SELECT 
            u.id_usuario, u.nome, u.email, u.perfil,
            t.nome AS turma_nome,
            at.id_turma
        FROM usuarios u
        LEFT JOIN alunos_turmas at ON u.id_usuario = at.id_aluno AND u.perfil = 'aluno'
        LEFT JOIN turmas t ON at.id_turma = t.id_turma
    `);
    res.json(rows);
});

// GET /api/usuarios/:id/turmas
router.get('/:id/turmas', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
    const [rows] = await pool.query('SELECT id_turma, materia FROM professores_turmas WHERE id_professor = ?', [req.params.id]);
    res.json(rows);
});

// POST /api/usuarios
router.post('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const { nome, email, senha, perfil, turmas, id_turma } = req.body; 
  if (!nome || !email || !senha || !perfil) return res.status(400).json({ error: 'Dados incompletos' });

  if (perfil === 'aluno' && !id_turma) {
    return res.status(400).json({ error: 'É obrigatório atribuir uma turma ao aluno no momento da matrícula.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const hash = await bcrypt.hash(senha, 10);
    const [result] = await connection.query('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)', [nome, email, hash, perfil]);
    const idUsuario = result.insertId;

    if (perfil === 'professor' && turmas && turmas.length > 0) {
      for (const t of turmas) {
        await connection.query('INSERT INTO professores_turmas (id_professor, id_turma, materia) VALUES (?, ?, ?)', [idUsuario, t.id_turma, t.materia]);
      }
    }

    if (perfil === 'aluno' && id_turma) {
        await connection.query('INSERT INTO alunos_turmas (id_aluno, id_turma, data_matricula) VALUES (?, ?, CURDATE())', [idUsuario, id_turma]);
    }

    await connection.commit();
    res.status(201).json({ id_usuario: idUsuario });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  } finally {
    connection.release();
  }
});

// PUT /api/usuarios/:id
router.put('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const idUsuario = req.params.id;
  const { nome, email, senha, perfil, turmas, id_turma } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    if (senha) {
        const hash = await bcrypt.hash(senha, 10);
        await connection.query('UPDATE usuarios SET nome=?, email=?, senha=?, perfil=? WHERE id_usuario=?', [nome, email, hash, perfil, idUsuario]);
    } else {
        await connection.query('UPDATE usuarios SET nome=?, email=?, perfil=? WHERE id_usuario=?', [nome, email, perfil, idUsuario]);
    }

    if (perfil === 'professor') {
        await connection.query('DELETE FROM professores_turmas WHERE id_professor = ?', [idUsuario]);
        if (turmas && turmas.length > 0) {
            for (const t of turmas) {
                await connection.query('INSERT INTO professores_turmas (id_professor, id_turma, materia) VALUES (?, ?, ?)', [idUsuario, t.id_turma, t.materia]);
            }
        }
    }

    if (perfil === 'aluno' && id_turma) {
        await connection.query('DELETE FROM alunos_turmas WHERE id_aluno = ?', [idUsuario]);
        await connection.query('INSERT INTO alunos_turmas (id_aluno, id_turma, data_matricula) VALUES (?, ?, CURDATE())', [idUsuario, id_turma]);
    }

    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar' });
  } finally {
    connection.release();
  }
});

module.exports = router;