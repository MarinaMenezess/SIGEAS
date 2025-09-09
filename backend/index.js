// index.js
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

// rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/turmas', turmasRoutes);
app.use('/api/chamadas', chamadasRoutes);
app.use('/api/notas', notasRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SIGEAS API rodando na porta ${PORT}`));
