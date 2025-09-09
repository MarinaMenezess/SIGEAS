-- Criação do banco
CREATE DATABASE sigeas;
USE sigeas;

-- ================================
-- Tabela de Usuários
-- ================================
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    perfil ENUM('administrador', 'professor', 'aluno') NOT NULL
);

-- ================================
-- Tabela de Turmas
-- ================================
CREATE TABLE turmas (
    id_turma INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    ano YEAR NOT NULL
);

-- ================================
-- Relacionamento N:N Professores x Turmas
-- ================================
CREATE TABLE professores_turmas (
    id_professor INT NOT NULL,
    id_turma INT NOT NULL,
    PRIMARY KEY (id_professor, id_turma),
    FOREIGN KEY (id_professor) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES turmas(id_turma)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================
-- Relacionamento N:N Alunos x Turmas (Matrículas)
-- ================================
CREATE TABLE alunos_turmas (
    id_aluno INT NOT NULL,
    id_turma INT NOT NULL,
    data_matricula DATE NOT NULL,
    PRIMARY KEY (id_aluno, id_turma),
    FOREIGN KEY (id_aluno) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES turmas(id_turma)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================
-- Tabela de Chamadas (Presença/Falta)
-- ================================
CREATE TABLE chamadas (
    id_chamada INT AUTO_INCREMENT PRIMARY KEY,
    id_aluno INT NOT NULL,
    id_turma INT NOT NULL,
    data DATE NOT NULL,
    status ENUM('presente', 'falta') NOT NULL,
    FOREIGN KEY (id_aluno) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES turmas(id_turma)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================
-- Tabela de Notas
-- ================================
CREATE TABLE notas (
    id_nota INT AUTO_INCREMENT PRIMARY KEY,
    id_aluno INT NOT NULL,
    id_turma INT NOT NULL,
    nota1 DECIMAL(5,2),
    nota2 DECIMAL(5,2),
    media_final DECIMAL(5,2),
    FOREIGN KEY (id_aluno) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES turmas(id_turma)
        ON DELETE CASCADE ON UPDATE CASCADE
);
