// routes/turmas.js
const express = require('express');
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../authMiddleware');
const router = express.Router();

// GET /api/turmas (Filtra por perfil de usuário)
router.get('/', authenticateToken, async (req, res) => {
    const user = req.user;
    try {
        if (user.perfil === 'administrador') {
            const [rows] = await pool.query(`
                SELECT t.*, u.nome as professor_nome 
                FROM turmas t 
                LEFT JOIN professores_turmas pt ON t.id_turma = pt.id_turma 
                LEFT JOIN usuarios u ON pt.id_professor = u.id_usuario
            `);
            return res.json(rows);
        }
        if (user.perfil === 'professor') {
            const [rows] = await pool.query(
              `SELECT t.*, pt.materia FROM turmas t
               JOIN professores_turmas pt ON pt.id_turma = t.id_turma
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
        res.status(500).json({ error: 'Erro ao buscar turmas' });
    }
});

// GET /api/turmas/:id/alunos (Busca alunos de uma turma)
router.get('/:id/alunos', authenticateToken, async (req, res) => {
  const id_turma = req.params.id;
  const user = req.user;
  try {
    // Apenas professores e administradores podem ver os alunos
    if (user.perfil === 'professor') {
      const [[assigned]] = await pool.query('SELECT 1 FROM professores_turmas WHERE id_professor=? AND id_turma=? LIMIT 1', [user.id_usuario, id_turma]);
      if (!assigned) return res.status(403).json({ error: 'Professor não alocado nesta turma' });
    }
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nome, u.email, at.data_matricula
       FROM usuarios u
       JOIN alunos_turmas at ON at.id_aluno = u.id_usuario
       WHERE at.id_turma = ?`, [id_turma]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar alunos da turma' });
  }
});

// GET /api/turmas/:id/alunos/faltas (Busca alunos e contabiliza as faltas por materia)
router.get('/:id/alunos/faltas', authenticateToken, authorizeRoles('professor'), async (req, res) => {
    const { id: id_turma } = req.params;
    const { id_usuario: id_professor } = req.user;

    try {
        const [[assigned]] = await pool.query('SELECT 1 FROM professores_turmas WHERE id_professor=? AND id_turma=? LIMIT 1', [id_professor, id_turma]);
        if (!assigned) return res.status(403).json({ error: 'Professor não alocado nesta turma' });

        const [alunos] = await pool.query(`
            SELECT 
                u.id_usuario, 
                u.nome, 
                u.email, 
                c.materia,
                COUNT(c.id_chamada) AS total_faltas
            FROM usuarios u
            JOIN alunos_turmas at ON u.id_usuario = at.id_aluno
            LEFT JOIN chamadas c ON u.id_usuario = c.id_aluno AND c.id_turma = at.id_turma AND c.status = 'falta'
            WHERE at.id_turma = ?
            GROUP BY u.id_usuario, u.nome, u.email, c.materia
            ORDER BY u.nome;
        `, [id_turma]);

        res.json(alunos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar alunos e suas faltas.' });
    }
});


// POST /api/turmas
router.post('/', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const { nome, descricao, ano, id_professor, materias } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('INSERT INTO turmas (nome, descricao, ano) VALUES (?, ?, ?)', [nome, descricao, ano]);
    const idTurma = result.insertId;
    if (id_professor && materias && materias.length > 0) {
      for (const materia of materias) {
        await connection.query('INSERT INTO professores_turmas (id_professor, id_turma, materia) VALUES (?, ?, ?)', [id_professor, idTurma, materia]);
      }
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

// PUT /api/turmas/:id
router.put('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  const idTurma = req.params.id;
  const { nome, descricao, ano, id_professor, materias } = req.body;
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

// DELETE /api/turmas/:id
router.delete('/:id', authenticateToken, authorizeRoles('administrador'), async (req, res) => {
  await pool.query('DELETE FROM turmas WHERE id_turma=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;