// middleware/asyncHandler.js
// Express 4 não captura erros de handlers async. Sem isto, uma exceção dentro de
// um `await` vira "unhandled rejection" (derruba o processo no Node 15+) e a
// requisição fica pendurada. Com o wrap, o erro cai no handler de erros do server.js.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
