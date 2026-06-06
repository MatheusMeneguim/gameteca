const express = require('express');
const app = express();
app.use(express.json());

// ---------------------------------------------------------
// Dados em memória — simula o "banco" deste microsserviço
// ---------------------------------------------------------
let jogos = [
  { id: 1, titulo: 'Hollow Knight',      plataforma: 'PC',     genero: 'Metroidvania' },
  { id: 2, titulo: 'Hades',             plataforma: 'Switch',  genero: 'Roguelike'    },
  { id: 3, titulo: 'Celeste',           plataforma: 'PC',     genero: 'Plataforma'   },
  { id: 4, titulo: 'Stardew Valley',    plataforma: 'PC',     genero: 'Simulação'    },
];
let proximoId = 5;

// ---------------------------------------------------------
// GET /jogos — lista todos
// ---------------------------------------------------------
app.get('/jogos', (req, res) => {
  res.json(jogos);
});

// ---------------------------------------------------------
// GET /jogos/:id — retorna um jogo específico
// Usamos Number() para converter o param (string) em número
// e conseguir comparar com os ids do array.
// ---------------------------------------------------------
app.get('/jogos/:id', (req, res) => {
  const jogo = jogos.find(j => j.id === Number(req.params.id));
  if (!jogo) {
    return res.status(404).json({ erro: 'Jogo não encontrado' });
  }
  res.json(jogo);
});

// ---------------------------------------------------------
// POST /jogos — cadastra novo jogo
// Body esperado: { titulo, plataforma, genero }
// ---------------------------------------------------------
app.post('/jogos', (req, res) => {
  const { titulo, plataforma, genero } = req.body;

  if (!titulo || !plataforma || !genero) {
    return res.status(400).json({ erro: 'titulo, plataforma e genero são obrigatórios' });
  }

  const novoJogo = { id: proximoId++, titulo, plataforma, genero };
  jogos.push(novoJogo);
  res.status(201).json(novoJogo);
});

// ---------------------------------------------------------
// DELETE /jogos/:id — remove um jogo
// filter() cria um novo array sem o item; se o tamanho não
// mudou, o jogo não existia.
// ---------------------------------------------------------
app.delete('/jogos/:id', (req, res) => {
  const antes = jogos.length;
  jogos = jogos.filter(j => j.id !== Number(req.params.id));

  if (jogos.length === antes) {
    return res.status(404).json({ erro: 'Jogo não encontrado' });
  }

  res.json({ mensagem: 'Jogo removido com sucesso' });
});

// ---------------------------------------------------------
app.listen(3001, () => {
  console.log('catalogo-service rodando na porta 3001');
});
