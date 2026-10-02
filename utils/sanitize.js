// utils/sanitize.js
// Normaliza texto vindo de fora: remove caracteres de controle, apara e limita o tamanho.
function limparTexto(valor, max = 100) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

// Nome de canal da Twitch: 3–25 caracteres, letras/números/underscore. Aceita "#canal".
function canalTwitchValido(valor) {
  const c = String(valor ?? "").trim().replace(/^#/, "").toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(c) ? c : null;
}

module.exports = { limparTexto, canalTwitchValido };
