# 🎮 Minha Gameteca — Microsserviços com Node.js e Express

Plataforma de coleção de jogos construída com arquitetura de microsserviços.  
Três serviços independentes se comunicam via HTTP para compor a resposta final.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                      CLIENTE                        │
│              (Insomnia / Postman / curl)             │
└─────────────────┬───────────────────────────────────┘
                  │ HTTP
                  ▼
┌─────────────────────────────┐
│    biblioteca-service :3000 │  ◄── orquestra os outros dois
└──────┬──────────────────────┘
       │ HTTP                 │ HTTP
       ▼                      ▼
┌─────────────┐     ┌──────────────────┐
│ usuarios-   │     │  catalogo-       │
│ service     │     │  service         │
│ :3002       │     │  :3001           │
└─────────────┘     └──────────────────┘
```

Cada serviço tem seus próprios dados e roda em uma porta diferente.  
O `biblioteca-service` **nunca** acessa diretamente os dados dos outros — ele faz chamadas HTTP, como qualquer cliente externo faria.

---

## Como rodar

Você precisa de **3 terminais abertos simultaneamente**.

### Terminal 1 — catálogo
```bash
cd catalogo-service
npm install
node server.js
# → catalogo-service rodando na porta 3001
```

### Terminal 2 — usuários
```bash
cd usuarios-service
npm install
node server.js
# → usuarios-service rodando na porta 3002
```

### Terminal 3 — biblioteca
```bash
cd biblioteca-service
npm install
node server.js
# → biblioteca-service rodando na porta 3000
```

> **Ordem importa:** suba o catálogo e os usuários **antes** da biblioteca, pois ela valida a existência dos recursos nos outros serviços ao fazer POST.

---

## Exemplos de requisição

### catalogo-service (porta 3001)

```
GET  http://localhost:3001/jogos
GET  http://localhost:3001/jogos/1

POST http://localhost:3001/jogos
Body: { "titulo": "Dead Cells", "plataforma": "PC", "genero": "Roguelike" }

DELETE http://localhost:3001/jogos/4
```

### usuarios-service (porta 3002)

```
GET  http://localhost:3002/usuarios
GET  http://localhost:3002/usuarios/1

POST http://localhost:3002/usuarios
Body: { "nome": "Diego Oliveira", "email": "diego@email.com" }
```

### biblioteca-service (porta 3000)

```
POST http://localhost:3000/biblioteca
Body: { "usuarioId": 1, "jogoId": 3 }

GET  http://localhost:3000/biblioteca/1
```

**Resposta esperada do GET /biblioteca/1:**
```json
{
  "id": 1,
  "nome": "Ana Silva",
  "email": "ana@email.com",
  "jogos": [
    { "id": 1, "titulo": "Hollow Knight", "plataforma": "PC",     "genero": "Metroidvania" },
    { "id": 2, "titulo": "Hades",         "plataforma": "Switch", "genero": "Roguelike"    }
  ]
}
```

---

## Fluxo de teste sugerido

1. Liste os jogos disponíveis: `GET /jogos`
2. Liste os usuários disponíveis: `GET /usuarios`
3. Adicione um jogo à biblioteca: `POST /biblioteca` com `{ "usuarioId": 2, "jogoId": 4 }`
4. Consulte a biblioteca completa: `GET /biblioteca/2`
5. Tente adicionar o mesmo jogo novamente → deve retornar `409 Conflict`
6. Derrube o `catalogo-service` (Ctrl+C) e consulte `GET /biblioteca/1` → deve retornar `503`

---

## Reflexão obrigatória

### O que acontece com a biblioteca se um serviço estiver fora do ar?

Se o `catalogo-service` cair, qualquer chamada `GET /biblioteca/:usuarioId` vai falhar com **503 Service Unavailable**, porque o `biblioteca-service` precisa buscar os dados dos jogos para montar a resposta. O usuário simplesmente não consegue ver sua biblioteca. Se for o `usuarios-service` a cair, o problema é ainda mais grave: nem dá pra saber se o usuário existe, então tanto o GET quanto o POST retornam 503. Isso revela uma fragilidade real dos microsserviços: a disponibilidade do sistema como um todo depende da disponibilidade de cada parte. Em produção, isso se resolve com circuit breakers (ex: padrão do Netflix Hystrix), cache local ou respostas degradadas — por exemplo, retornar os dados do usuário com a lista de jogos vazia em vez de um erro total.

### Quais são as vantagens da separação?

Cada serviço pode ser desenvolvido, testado, deployado e escalado de forma independente. Se o catálogo de jogos recebe muito tráfego em um lançamento, você escala **só** o `catalogo-service` sem tocar nos outros. Equipes diferentes podem trabalhar em paralelo sem conflitos de merge. A falha de um serviço não derruba os outros (o `usuarios-service` continua funcionando mesmo que o catálogo caia). Em um monolito, um bug em qualquer módulo pode derrubar a aplicação inteira.

### Que problemas novos surgem?

A latência aumenta: uma operação que antes era uma chamada de função local vira 2 ou 3 chamadas HTTP. A complexidade operacional explode: são 3 processos para subir, monitorar e logar — em produção, isso vira Kubernetes, Docker Compose, service discovery e afins. A consistência de dados fica mais difícil: se o usuário for deletado do `usuarios-service` mas ainda existir registros no `biblioteca-service`, temos dados órfãos (no monolito, uma foreign key resolveria isso automaticamente). Debugging distribuído também é desafiador: um erro pode ter origem em qualquer um dos serviços, e rastrear o caminho completo de uma requisição exige ferramentas como distributed tracing (Jaeger, Zipkin).

---

## Bônus implementados

- **Bônus 1** ✅ — Tratamento de erros de comunicação no `biblioteca-service`: retorna `503` com mensagem clara se qualquer serviço dependente estiver fora do ar.
