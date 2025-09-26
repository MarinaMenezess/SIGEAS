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
-- Relacionamento N:N Professores x Turmas (CORRIGIDO: Adicionado 'materia')
-- ================================
CREATE TABLE professores_turmas (
    id_professor INT NOT NULL,
    id_turma INT NOT NULL,
    materia VARCHAR(100) NOT NULL, -- Coluna 'materia' é necessária para a lógica de atribuição
    PRIMARY KEY (id_professor, id_turma, materia),
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
-- Tabela de Chamadas (Presença/Falta) (CORRIGIDO: Adicionado 'materia')
-- ================================
CREATE TABLE chamadas (
    id_chamada INT AUTO_INCREMENT PRIMARY KEY,
    id_aluno INT NOT NULL,
    id_turma INT NOT NULL,
    materia VARCHAR(100) NOT NULL, -- Coluna 'materia' é necessária para a lógica de chamada
    data DATE NOT NULL,
    status ENUM('presente', 'falta') NOT NULL,
    FOREIGN KEY (id_aluno) REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES turmas(id_turma)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ================================
-- Tabela de Avaliacoes (CORRIGIDO: Adicionado 'materia')
-- ================================
CREATE TABLE avaliacoes (
    id_avaliacao INT AUTO_INCREMENT PRIMARY KEY,
    id_aluno INT NOT NULL,
    id_turma INT NOT NULL,
    materia VARCHAR(100) NOT NULL, -- Coluna 'materia' é necessária para a lógica de notas
    descricao VARCHAR(100),
    nota DECIMAL(5,2) NOT NULL,
    data_avaliacao DATE NOT NULL,
    trimestre INT NOT NULL, 
    FOREIGN KEY (id_aluno) REFERENCES usuarios(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (id_turma) REFERENCES turmas(id_turma) ON DELETE CASCADE ON UPDATE CASCADE
);