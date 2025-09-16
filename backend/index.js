// backend/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const turmasRoutes = require('./routes/turmas');
const chamadasRoutes = require('./routes/chamadas');
const notasRoutes = require('./routes/notas');

const app = express();
app.use(cors());
app.use(express.json());

// ================================================================
// DEBUG: Verificando o registo das rotas
console.log("--- INICIANDO REGISTO DE ROTAS ---");
app.use('/api/auth', authRoutes);
console.log("✅ Rota /api/auth registrada.");
app.use('/api/usuarios', usuariosRoutes);
console.log("✅ Rota /api/usuarios registrada.");
app.use('/api/turmas', turmasRoutes);
console.log("✅ Rota /api/turmas registrada."); // Esta é a linha mais importante!
app.use('/api/chamadas', chamadasRoutes);
console.log("✅ Rota /api/chamadas registrada.");
app.use('/api/notas', notasRoutes);
console.log("✅ Rota /api/notas registrada.");
console.log("------------------------------------");
// ================================================================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SIGEAS API rodando na porta ${PORT}`));