// seed.js
const pool = require('./db');
const bcrypt = require('bcrypt');

async function run(){
  try {
    // Insere usuários exemplo
    const senhaAdmin = await bcrypt.hash('senha', 10);
    const senhaProf = await bcrypt.hash('senha', 10);
    const senhaStu = await bcrypt.hash('senha', 10);

    await pool.query('INSERT INTO usuarios (nome,email,senha,perfil) VALUES (?, ?, ?, ?)', ['Mari', 'mari@sigeas.com', senhaAdmin, 'administrador']);
    const [r1] = await pool.query('INSERT INTO usuarios (nome,email,senha,perfil) VALUES (?, ?, ?, ?)', ['Arlan', 'arlan@sigeas.com', senhaProf, 'professor']);
    const idProf = r1.insertId;
    await pool.query('INSERT INTO usuarios (nome,email,senha,perfil) VALUES (?, ?, ?, ?), (?, ?, ?, ?)', ['Marina','marina@sigeas.com',senhaStu,'aluno']);

    // criar turma
    const [tm] = await pool.query('INSERT INTO turmas (nome, descricao, ano) VALUES (?, ?, ?)', ['3BM', 'Turma mais legal', 2025]);
    const idTurma = tm.insertId;

    // associar professor e matricular alunos
    // CORREÇÃO: Adicionando 'materia' que é agora obrigatório
    await pool.query('INSERT INTO professores_turmas (id_professor, id_turma, materia) VALUES (?, ?, ?)', [idProf, idTurma, 'filosofia']);

    // pega ids dos alunos
    const [alunos] = await pool.query('SELECT id_usuario FROM usuarios WHERE perfil = "aluno"');
    for (const a of alunos) {
      await pool.query('INSERT INTO alunos_turmas (id_aluno, id_turma, data_matricula) VALUES (?, ?, CURDATE())', [a.id_usuario, idTurma]);
    }

    console.log('Seed finalizado com sucesso');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
