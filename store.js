// store.js
// Persistência simples em arquivo JSON local.
// No Render o disco é efêmero — os dados voltam ao padrão a cada deploy.
// Para persistência real, migre para PostgreSQL / Redis.

const fs = require("fs");
const path = require("path");

const STORE_FILE = path.join(__dirname, "data.json");

const DEFAULT_STATE = {
  // ── Configurações gerais ──────────────────────────────────────────
  config: {
    titulo: "Rindo e Apoiando !!",
    channelName: "isaroza_",
    tempoPadrao: 5,          // segundos de giro padrão
    modoCor: "colorido",     // "colorido" | "neutro"
    temaAtivo: "Padrão Rosa",
    autoRemoverVencedor: false,
    autoOcultarPainel: true,
    temaAutoRotar: true,
  },

  // ── Sons ──────────────────────────────────────────────────────────
  sons: {
    musicaSelecionada: 0,    // índice 0–17
    volumeMusica: 0.1,
    volumeTick: 0.12,
    tocarMusicaAoGirar: false,
  },

  // ── Arena / Bonecos ───────────────────────────────────────────────
  arena: {
    userCooldown: 15000,     // ms por usuário
    globalCooldown: 5000,    // ms entre spawns
    maxBonecos: 30,
    posicaoBoneco: "frente", // "frente" | "atras" | "desativado"
  },

  // ── Imagens personalizadas ────────────────────────────────────────
  imagens: {
    bonecos: [],   // arquivos em /uploads/bonecos/
    centro:  null, // <img class="centro">
    leoeisa: null, // body::before
    back:    null, // body.painel-oculto::before
    gato1:   null, // .centrochat
    will:    null, // favicon
  },

  // ── Filmes (espelho do backend de filmes, se existir) ────────────
  filmes: {
    apiUrl: "",              // URL da sua API de filmes no Render
    categoriaPadrao: "",
    votosAtivo: false,
    votosBase: 50,
    ticketsPorVotos: 1,
    ticketsMin: 1,
    ticketsMax: 20,
  },
};

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      // merge profundo: padrões + dados salvos
      const saved = JSON.parse(raw);
      return deepMerge(DEFAULT_STATE, saved);
    }
  } catch (e) {
    console.error("[store] Erro ao carregar data.json:", e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function save(state) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (e) {
    console.error("[store] Erro ao salvar data.json:", e.message);
  }
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// Singleton em memória
let _state = load();

module.exports = {
  get: () => _state,
  set: (newState) => {
    _state = newState;
    save(_state);
  },
  patch: (section, partial) => {
    _state[section] = { ..._state[section], ...partial };
    save(_state);
    return _state[section];
  },
  reset: () => {
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    save(_state);
    return _state;
  },
};
