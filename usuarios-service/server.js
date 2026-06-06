const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------
// Dados em memória — cada microsserviço tem seus próprios dados.
// Nenhum outro serviço acessa diretamente este array.
// ---------------------------------------------------------
let usuarios = [
  { id: 1, nome: 'Ana Silva',    email: 'ana@email.com'    },
  { id: 2, nome: 'Bruno Costa',  email: 'bruno@email.com'  },
  { id: 3, nome: 'Carla Mendes', email: 'carla@email.com'  },
];
let proximoId = 4;

// ---------------------------------------------------------
// GET /usuarios — lista todos
// ---------------------------------------------------------
app.get('/usuarios', (req, res) => {
  res.json(usuarios);
});

// ---------------------------------------------------------
// GET /usuarios/:id — retorna um usuário específico
// O biblioteca-service vai chamar exatamente esta rota para
// buscar os dados do usuário antes de montar a resposta final.
// ---------------------------------------------------------
app.get('/usuarios/:id', (req, res) => {
  const usuario = usuarios.find(u => u.id === Number(req.params.id));
  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }
  res.json(usuario);
});

// ---------------------------------------------------------
// POST /usuarios — cadastra novo usuário
// Body esperado: { nome, email }
// ---------------------------------------------------------
app.post('/usuarios', (req, res) => {
  const { nome, email } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ erro: 'nome e email são obrigatórios' });
  }

  const novoUsuario = { id: proximoId++, nome, email };
  usuarios.push(novoUsuario);
  res.status(201).json(novoUsuario);
});

// ---------------------------------------------------------
app.listen(3002, () => {
  console.log('usuarios-service rodando na porta 3002');
});
