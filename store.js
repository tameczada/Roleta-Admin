// store.js
// Persistência do estado da roleta via Supabase (tabela roleta_estado, linha única id='main').
// Mantém um cache em memória (_state) para leituras síncronas nas rotas — igual ao
// comportamento antigo baseado em data.json — e grava no Supabase em segundo plano
// a cada mudança.
const supabase = require("./supabase/client");

const ROW_ID = "main";

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
    vencedorForcado: "",   // nome que deve ganhar no próximo giro (vazio = sorteio aleatório normal)
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

let _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let _ready = false;

// Carrega o estado do Supabase na subida do servidor.
// Se a linha ainda não existir (primeiro deploy), cria com os valores padrão.
async function init() {
  try {
    const { data, error } = await supabase
      .from("roleta_estado")
      .select("data")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) throw error;

    if (data?.data) {
      _state = deepMerge(DEFAULT_STATE, data.data);
      console.log("[store] Estado carregado do Supabase.");
    } else {
      _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      await persist();
      console.log("[store] Nenhum estado encontrado — linha inicial criada no Supabase.");
    }
  } catch (e) {
    console.error("[store] Erro ao carregar estado do Supabase, usando padrões em memória:", e.message);
    _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  _ready = true;
}

// Grava o estado atual no Supabase (upsert da linha única).
async function persist() {
  try {
    const { error } = await supabase
      .from("roleta_estado")
      .upsert({ id: ROW_ID, data: _state, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    console.error("[store] Erro ao salvar estado no Supabase:", e.message);
  }
}

// Salva em segundo plano (não bloqueia a resposta HTTP) — mesmo espírito do
// fs.writeFileSync "melhor esforço" que existia antes, mas agora assíncrono.
function save(state) {
  _state = state;
  persist();
}

module.exports = {
  isReady: () => _ready,
  init,
  get: () => _state,
  set: (newState) => { save(newState); },
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
