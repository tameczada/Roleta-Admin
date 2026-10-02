// store.js
// Persistência do estado da roleta via Supabase (tabela roleta_estado, linha única id='main').
// Mantém um cache em memória (_state) para leituras síncronas nas rotas e grava no
// Supabase em segundo plano a cada mudança.
//
// Proteções (v3.1):
//  - Se o estado NÃO foi lido do banco (Supabase fora do ar / mal configurado), o store
//    entra em modo degradado: continua funcionando em memória, mas NÃO grava — antes,
//    o próximo save sobrescrevia o estado real do banco com os valores padrão.
//    Ele tenta recarregar do banco a cada 30 s.
//  - Gravações são serializadas/coalescidas (uma por vez, sempre com o estado mais novo),
//    evitando que dois upserts concorrentes terminem fora de ordem.
//  - set() sempre completa as seções faltantes com os padrões, então nenhuma rota
//    consegue "apagar" seções inteiras (visual, participantes, playlist, historico).
const supabase = require("./supabase/client");

const ROW_ID = "main";
const RETRY_MS = 30_000;

const clone = (o) => JSON.parse(JSON.stringify(o));

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

  // Playlist de músicas enviadas pelo painel (Supabase Storage)
  playlist: [],

  // Histórico dos últimos 50 vencedores
  historico: [],
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    const s = source[key];
    const t = target ? target[key] : undefined;
    if (s !== null && typeof s === "object" && !Array.isArray(s)
        && t !== null && typeof t === "object" && !Array.isArray(t)) {
      result[key] = deepMerge(t, s);
    } else {
      result[key] = s;
    }
  }
  return result;
}

let _state = clone(DEFAULT_STATE);
let _ready = false;
let _loaded = false;      // true só depois de ler (ou criar) a linha no banco
let _retryTimer = null;
let _saving = false;
let _dirty = false;
let _saveRetry = null;

// Lê o estado do Supabase. Lança erro se não conseguir (nunca cai em "padrões" em silêncio).
async function carregar() {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("roleta_estado")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) throw error;

  if (data?.data) {
    _state = deepMerge(clone(DEFAULT_STATE), data.data);
    _loaded = true;
    console.log("[store] Estado carregado do Supabase.");
  } else {
    // Primeiro deploy: a linha ainda não existe — cria com os valores padrão.
    _state = clone(DEFAULT_STATE);
    _loaded = true;
    await gravar();
    console.log("[store] Nenhum estado encontrado — linha inicial criada no Supabase.");
  }
}

function agendarRetry() {
  if (_retryTimer) return;
  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    try {
      await carregar();
      console.warn("[store] Supabase voltou — estado recarregado do banco (alterações feitas durante a queda não foram gravadas).");
    } catch (e) {
      agendarRetry();
    }
  }, RETRY_MS);
  if (_retryTimer.unref) _retryTimer.unref();
}

async function init() {
  try {
    await carregar();
  } catch (e) {
    console.error("[store] Não foi possível carregar o estado do Supabase:", e.message);
    console.error("[store] MODO DEGRADADO: usando padrões em memória e NÃO gravando no banco até o Supabase voltar.");
    _state = clone(DEFAULT_STATE);
    _loaded = false;
    agendarRetry();
  }
  _ready = true;
}

// Grava o estado atual (upsert da linha única). Uma gravação por vez; se chegar
// mudança durante uma gravação, faz mais uma rodada com o estado mais recente.
async function gravar() {
  if (!_loaded) return; // modo degradado — não sobrescreve o banco
  if (_saving) { _dirty = true; return; }
  _saving = true;
  try {
    do {
      _dirty = false;
      const { error } = await supabase
        .from("roleta_estado")
        .upsert({ id: ROW_ID, data: clone(_state), updated_at: new Date().toISOString() });
      if (error) throw error;
    } while (_dirty);
  } catch (e) {
    console.error("[store] Erro ao salvar estado no Supabase:", e.message);
    if (!_saveRetry) {
      _saveRetry = setTimeout(() => { _saveRetry = null; gravar(); }, 10_000);
      if (_saveRetry.unref) _saveRetry.unref();
    }
  } finally {
    _saving = false;
  }
}

function save(state) {
  _state = state;
  gravar(); // segundo plano — não bloqueia a resposta HTTP
}

module.exports = {
  isReady: () => _ready,
  isPersistent: () => _loaded,
  init,
  get: () => _state,
  // Substitui o estado; seções ausentes são preenchidas com os padrões.
  set: (newState) => { save(deepMerge(clone(DEFAULT_STATE), newState)); return _state; },
  patch: (section, partial) => {
    _state[section] = { ...(_state[section] || {}), ...partial };
    save(_state);
    return _state[section];
  },
  pushHistorico: (vencedor) => {
    const atual = Array.isArray(_state.historico) ? _state.historico : [];
    _state.historico = [vencedor, ...atual].slice(0, 50);
    save(_state);
    return _state.historico;
  },
  reset: () => { save(clone(DEFAULT_STATE)); return _state; },
  _deepMerge: deepMerge, // exposto para testes
};
