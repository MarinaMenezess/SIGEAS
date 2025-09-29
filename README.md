# 📚 PROJETO SIGEAS - Sistema de Gestão de Aulas

**Tarefa 1 – Pesquisa, Concepção e Design (UX/UI)**

## 🌟 Visão Geral do Projeto

O SIGEAS é um Sistema de Gestão de Aulas completo, desenvolvido para centralizar as operações acadêmicas e administrativas. Ele fornece painéis dedicados para Administradores, Professores e Alunos, permitindo a gestão de turmas, matrículas, lançamento de notas e controle de frequência.

O projeto foi estruturado em um backend (API REST) em Node.js e um frontend simples em HTML, CSS e JavaScript puro para demonstrar as funcionalidades.

## ✨ Identidade Visual e Design

A identidade visual do SIGEAS foi concebida para transmitir tranquilidade, confiança e modernidade.

| Elemento | Cor | Código |
| :--- | :--- | :--- |
| **Primária** (Destaque/Botões) | Azul Petróleo | `#167D7F` |
| **Secundária 1** (Títulos) | Azul Claro | `#29A0B1` |
| **Secundária 2** (Fundo de Elementos) | Verde Médio | `#98D7C2` |
| **Fundo Principal** | Verde Claro | `#DDFFE7` |

**Tipografia:** Montserrat, escolhida pela clareza e alta legibilidade.

## 💻 Tecnologias

**Backend (API REST):**
* **Linguagem:** Node.js
* **Framework:** Express
* **Banco de Dados:** MySQL (utilizando `mysql2`)
* **Segurança:** JWT (`jsonwebtoken`) para autenticação e `bcrypt` para hash de senhas.

**Frontend:**
* **Linguagens:** HTML5, CSS3, JavaScript puro.

## 🏗️ Estrutura do Projeto

O projeto está organizado em duas pastas principais: `backend` (API) e `frontend` (Interface Web).


```text
├── .gitignore
├── DESIGN.md
├── package-lock.json
├── backend/
│   ├── .env                       # Variáveis de ambiente (conexão com DB, JWT Secret)
│   ├── index.js                   # Ponto de entrada da aplicação e registro de rotas
│   ├── package.json               # Dependências do Node.js
│   ├── package-lock.json
│   ├── db.js                      # Configuração da pool de conexão com MySQL
│   ├── db.sql                     # Script de criação do schema e tabelas
│   ├── authMiddleware.js          # Middleware de autenticação JWT e autorização de perfis
│   ├── seed.js                    # Script para popular o DB com dados de teste
│   └── routes/                    # Definição das rotas da API
│       ├── auth.js                # Rota de Login
│       ├── usuarios.js            # Rotas para gestão de usuários (CRUD, listagem)
│       ├── turmas.js              # Rotas para gestão de turmas (CRUD, listagem, alunos da turma)
│       ├── chamadas.js            # Rotas para gestão de presença e falta
│       └── notas.js               # Rotas para gestão de notas e avaliações
└── frontend/
    ├── index.html                 # Página de Login
    ├── admin.html                 # Painel do Administrador
    ├── professor.html             # Painel do Professor
    ├── aluno.html                 # Painel do Aluno
    ├── style.css                  # Estilos globais da interface
    └── script.js                  # Lógica de interação e chamadas à API (frontend)
```

## ⚙️ Configuração e Execução

### 1. Configuração do Banco de Dados (MySQL)

1.  **Crie o Banco:** Crie um banco de dados chamado `sigeas` no seu servidor MySQL.
2.  **Crie as Tabelas:** Execute o script `backend/db.sql` para criar todas as tabelas necessárias (usuarios, turmas, professores_turmas, alunos_turmas, chamadas, avaliacoes).

### 2. Configuração e Inicialização do Backend

1.  **Variáveis de Ambiente:** No diretório `backend/`, crie um arquivo `.env` (se ainda não existir) e configure as credenciais do seu banco de dados MySQL.
    ```env
    PORT=4000
    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=root
    DB_PASS=SUA_SENHA_MYSQL
    DB_NAME=sigeas
    JWT_SECRET=algunhasecretomuitoforte
    JWT_EXPIRES_IN=8h
    ```
2.  **Instale as Dependências:**
    ```bash
    cd backend
    npm install
    ```
3.  **Popule com Dados de Teste:** (Opcional, mas recomendado)
    ```bash
    npm run seed 
    ```
    Este comando cria um administrador, um professor e dois alunos de exemplo.
4.  **Inicie o Servidor:**
    ```bash
    npm start
    # A API estará rodando em http://localhost:4000
    ```

### 3. Execução do Frontend

1.  Abra o arquivo `frontend/index.html` diretamente no seu navegador.

## 🔑 Credenciais de Teste

Utilize as seguintes credenciais no painel de Login (`index.html`):

| Perfil | Usuário (Exemplo) | Senha |
| :--- | :--- | :--- |
| **Administrador** | `admin` (ou `mari@sigeas.com`) | `senha` |
| **Professor** | `professor` (ou `iuri@sigeas.com`) | `senha` |
| **Aluno** | `aluno` (ou `marina@sigeas.com`) | `senha` |

## 🧠 Dificuldades e Aprendizados

Esta seção descreve os principais desafios enfrentados e as lições aprendidas durante o desenvolvimento do projeto SIGEAS:

* **Desafio de UX/UI:** Uma dificuldade encontrada foi a idealização de uma interface que fosse simultaneamente bonita, intuitiva e simples, resultando na percepção de que a performance no quesito design poderia ter sido melhor.
* **Reestruturação do Modelo de Turmas:** Outra dificuldade significativa foi o sistema de associação entre professores, matérias e turmas. Inicialmente, o projeto considerava o modelo de um professor por turma, responsável por todas as matérias. Ao perceber a necessidade de permitir que vários professores gerenciassem a mesma turma, cada um focado em matérias específicas, foi preciso reestruturar o projeto já em andamento. Essa reestruturação envolveu a criação de uma relação N:N mais complexa (`professores_turmas`) que inclui a coluna `materia`.
