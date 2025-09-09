// routes/usuarios.js
const express = require('express');
const pool = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/usuarios (sem alterações)
router.get('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
    const [rows] = await pool.query('SELECT id_usuario, nome, email, perfil FROM usuarios');
    res.json(rows);
});

// GET /api/usuarios/:id/turmas (sem alterações)
router.get('/:id/turmas', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
    const [rows] = await pool.query('SELECT id_turma FROM professores_turmas WHERE id_professor = ?', [req.params.id]);
    res.json(rows.map(r => r.id_turma));
});


// POST /api/usuarios (CORRIGIDO)
router.post('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  // Adicionado 'id_turma' para o caso do aluno
  const { nome, email, senha, perfil, turmas, id_turma } = req.body; 
  if (!nome || !email || !senha || !perfil) return res.status(400).json({ error: 'Dados incompletos' });
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const hash = await bcrypt.hash(senha, 10);
    const [result] = await connection.query('INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)', [nome, email, hash, perfil]);
    const idUsuario = result.insertId;

    // Se for um professor e houver turmas selecionadas, associa
    if (perfil === 'professor' && turmas && turmas.length > 0) {
      for (const idTurma of turmas) {
        await connection.query('INSERT INTO professores_turmas (id_professor, id_turma) VALUES (?, ?)', [idUsuario, idTurma]);
      }
    }

    // Se for um aluno e uma turma foi selecionada, matricula
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

// PUT /api/usuarios/:id (sem alterações)
router.put('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const idUsuario = req.params.id;
  const { nome, email, senha, perfil, turmas } = req.body;
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
            for (const idTurma of turmas) {
                await connection.query('INSERT INTO professores_turmas (id_professor, id_turma) VALUES (?, ?)', [idUsuario, idTurma]);
            }
        }
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