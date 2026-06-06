const express = require('express');
const axios   = require('axios');
const app     = express();
app.use(express.json());

// ---------------------------------------------------------
// URLs dos outros microsserviços.
// Centralizar aqui facilita trocar para variáveis de ambiente
// futuramente (process.env.CATALOGO_URL, etc).
// ---------------------------------------------------------
const CATALOGO_URL  = 'http://localhost:3001';
const USUARIOS_URL  = 'http://localhost:3002';

// ---------------------------------------------------------
// Dados em memória — apenas a relação usuário ↔ jogo.
// Este serviço NÃO guarda nome de usuário nem título de jogo;
// ele só conhece ids. Os dados reais ficam em cada serviço dono.
// ---------------------------------------------------------
let biblioteca = [];
// ---------------------------------------------------------
// POST /biblioteca — associa um jogo a um usuário
// Body: { usuarioId, jogoId }
//
// Antes de salvar, verificamos se o usuário e o jogo existem
// nos seus respectivos serviços. Se qualquer um retornar 404
// (ou o serviço estiver fora do ar), respondemos com erro.
// ---------------------------------------------------------
app.post('/biblioteca', async (req, res) => {
  const { usuarioId, jogoId } = req.body;

  if (!usuarioId || !jogoId) {
    return res.status(400).json({ erro: 'usuarioId e jogoId são obrigatórios' });
  }

  try {
    // Validação: os dois existem? (chamadas em paralelo para ganhar tempo)
    await Promise.all([
      axios.get(`${USUARIOS_URL}/usuarios/${usuarioId}`),
      axios.get(`${CATALOGO_URL}/jogos/${jogoId}`),
    ]);
  } catch (err) {
    // Se o erro veio de um 404, informamos o que não existe.
    // Se veio de conexão recusada, avisamos que o serviço está fora.
    if (err.response?.status === 404) {
      return res.status(404).json({ erro: 'Usuário ou jogo não encontrado' });
    }
    return res.status(503).json({
      erro: 'Um dos serviços dependentes está indisponível. Tente novamente mais tarde.',
    });
  }

  // Evita duplicata na biblioteca do usuário
  const jaExiste = biblioteca.some(
    b => b.usuarioId === Number(usuarioId) && b.jogoId === Number(jogoId)
  );
  if (jaExiste) {
    return res.status(409).json({ erro: 'Este jogo já está na biblioteca do usuário' });
  }

  const registro = { usuarioId: Number(usuarioId), jogoId: Number(jogoId) };
  biblioteca.push(registro);
  res.status(201).json({ mensagem: 'Jogo adicionado à biblioteca', registro });
});

// ---------------------------------------------------------
// GET /biblioteca/:usuarioId — retorna o usuário com todos
// os seus jogos populados (dados reais vindos dos outros serviços).
//
// Fluxo:
//  1. Busca o usuário em usuarios-service (1 chamada HTTP)
//  2. Filtra os registros da biblioteca para este usuário
//  3. Busca cada jogo em catalogo-service em paralelo (N chamadas)
//  4. Monta e retorna o objeto final composto
//
// Promise.all() é essencial aqui: em vez de buscar jogo 1,
// esperar, buscar jogo 2, esperar... buscamos todos ao mesmo tempo.
// ---------------------------------------------------------
app.get('/biblioteca/:usuarioId', async (req, res) => {
  const usuarioId = Number(req.params.usuarioId);

  // -- 1. Busca o usuário --
  let usuario;
  try {
    const resp = await axios.get(`${USUARIOS_URL}/usuarios/${usuarioId}`);
    usuario = resp.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    return res.status(503).json({ erro: 'usuarios-service está indisponível' });
  }

  // -- 2. Quais jogos este usuário tem? --
  const registros = biblioteca.filter(b => b.usuarioId === usuarioId);

  // -- 3. Busca todos os jogos em paralelo --
  let jogos = [];
  try {
    const respostas = await Promise.all(
      registros.map(r => axios.get(`${CATALOGO_URL}/jogos/${r.jogoId}`))
    );
    jogos = respostas.map(r => r.data);
  } catch (err) {
    if (err.response?.status === 404) {
      // Um jogo foi removido do catálogo mas ainda está na biblioteca.
      // Podemos retornar parcial ou erro. Aqui optamos por erro explícito.
      return res.status(404).json({ erro: 'Um dos jogos da biblioteca não foi encontrado no catálogo' });
    }
    return res.status(503).json({ erro: 'catalogo-service está indisponível' });
  }

  // -- 4. Compõe a resposta final --
  res.json({ ...usuario, jogos });
});

// ---------------------------------------------------------
app.listen(3000, () => {
  console.log('biblioteca-service rodando na porta 3000');
});
