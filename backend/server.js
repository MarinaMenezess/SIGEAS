// ==============================
// SIGEAS - Backend (server.js)
// ==============================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");

const app = express();
app.use(express.json());
app.use(cors());

// ==============================
// Conexão com MySQL
// ==============================
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "sigeas",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
  } else {
    console.log("✅ Conectado ao MySQL!");
  }
});

// ==============================
// Middleware de Autenticação
// ==============================
function autenticarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || "segredo", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ==============================
// Rota de Login
// ==============================
app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  db.query("SELECT * FROM usuarios WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err });

    if (results.length === 0) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    const usuario = results[0];

    // ⚠️ se as senhas não forem criptografadas, trocar para: if (senha !== usuario.senha)
    const senhaValida = await bcrypt.compare(senha, usuario.senha).catch(() => false);

    if (!senhaValida) {
      return res.status(401).json({ message: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, perfil: usuario.perfil },
      process.env.JWT_SECRET || "segredo",
      { expiresIn: "1h" }
    );

    res.json({ token, perfil: usuario.perfil });
  });
});

// ==============================
// Rotas de Turmas (exemplo CRUD)
// ==============================

// Criar turma
app.post("/turmas", autenticarToken, (req, res) => {
  if (req.user.perfil !== "administrador") return res.sendStatus(403);

  const { nome, descricao, ano } = req.body;
  db.query(
    "INSERT INTO turmas (nome, descricao, ano) VALUES (?, ?, ?)",
    [nome, descricao, ano],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Turma criada com sucesso", id: result.insertId });
    }
  );
});

// Listar turmas
app.get("/turmas", autenticarToken, (req, res) => {
  db.query("SELECT * FROM turmas", (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Buscar turma por ID
app.get("/turmas/:id", autenticarToken, (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM turmas WHERE id_turma = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: "Turma não encontrada" });
    res.json(results[0]);
  });
});

// Atualizar turma
app.put("/turmas/:id", autenticarToken, (req, res) => {
  if (req.user.perfil !== "administrador") return res.sendStatus(403);

  const { id } = req.params;
  const { nome, descricao, ano } = req.body;
  db.query(
    "UPDATE turmas SET nome = ?, descricao = ?, ano = ? WHERE id_turma = ?",
    [nome, descricao, ano, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "Turma atualizada com sucesso" });
    }
  );
});

// Deletar turma
app.delete("/turmas/:id", autenticarToken, (req, res) => {
  if (req.user.perfil !== "administrador") return res.sendStatus(403);

  const { id } = req.params;
  db.query("DELETE FROM turmas WHERE id_turma = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ message: "Turma excluída com sucesso" });
  });
});

// ==============================
// Servidor rodando
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
