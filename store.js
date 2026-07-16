// store.js
const fs   = require("fs");
const path = require("path");

const STORE_FILE = path.join(__dirname, "data.json");

const DEFAULT_STATE = {
  config: {
    titulo: "Rindo e Apoiando !!",
    channelName: "isaroza_",
    tempoPadrao: 5,
    modoCor: "colorido",
    temaAtivo: "Padrão Rosa",
    autoRemoverVencedor: false,
    autoOcultarPainel: true,
    temaAutoRotar: true,
  },

  sons: {
    musicaSelecionada: 0,
    volumeMusica: 0.1,
    volumeTick: 0.12,
    tocarMusicaAoGirar: false,
  },

  arena: {
    // Cooldowns
    userCooldown:   15000,
    globalCooldown: 5000,
    maxBonecos:     30,
    posicaoBoneco:  "frente",      // "frente" | "atras" | "desativado"
    // Cores dos nomes
    nomeCores:      "aleatorio",   // "aleatorio" | "fixo" | "desativado"
    nomeCorFixa:    "#ffffff",
    nomePaleta:     [],
    // Visual dos bonecos
    escala:         1.0,           // 0.5–3.0
    velocidade:     1.0,           // multiplicador (0.1–5.0)
    tempoVida:      0,             // segundos até sumir (0 = infinito)
    // Nome
    nomeFonte:      "Arial",
    nomeTamanho:    13,            // px
    // Animação de entrada
    animEntrada:    "normal",      // "normal" | "queda" | "fade" | "bounce"
    // Comando
    comando:        "!entrar",
    // Modo teste
    modoTeste:      false,
    testeIntervalo: 3,             // segundos entre spawns no modo teste
    // Modo de imagem dos bonecos
    modoImagem:     "boneco",      // "boneco" | "perfil" | "aleatorio"
    twitchClientId: "x4qevszaoxnscv462g6913dzo3m71t",
  },

  visual: {
    fundoBlur:      2,             // px de blur no fundo (0–20)
    fundoBrilho:    0.6,           // 0.0–1.0
  },

  imagens: {
    bonecos: [],
    centro:  null,
    leoeisa: null,
    back:    null,
    gato1:   null,
    will:    null,
  },

  filmes: {
    apiUrl: "",
    categoriaPadrao: "",
    votosAtivo: false,
    votosBase: 50,
    ticketsPorVotos: 1,
    ticketsMin: 1,
    ticketsMax: 20,
  },

  // Participantes importados via CSV
  participantes: [],

  // Histórico dos últimos 50 vencedores
  historico: [],
};

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      return deepMerge(DEFAULT_STATE, saved);
    }
  } catch (e) { console.error("[store] Erro ao carregar:", e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function save(state) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8"); }
  catch (e) { console.error("[store] Erro ao salvar:", e.message); }
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])
        && typeof target[key] === "object" && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

let _state = load();

module.exports = {
  get: () => _state,
  set: (newState) => { _state = newState; save(_state); },
  patch: (section, partial) => {
    _state[section] = { ..._state[section], ...partial };
    save(_state);
    return _state[section];
  },
  pushHistorico: (vencedor) => {
    _state.historico = [vencedor, ..._state.historico].slice(0, 50);
    save(_state);
    return _state.historico;
  },
  reset: () => { _state = JSON.parse(JSON.stringify(DEFAULT_STATE)); save(_state); return _state; },
};
