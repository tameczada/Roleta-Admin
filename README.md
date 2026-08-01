# 🎡 Roleta Admin — Backend

Backend Express para controlar os parâmetros da roleta da **isaroza_**, pronto para deploy no Render.

---

## 📦 Estrutura

```
roleta-admin-backend/
├── server.js              # Entry point
├── store.js               # Persistência em data.json
├── middleware/
│   └── auth.js            # Autenticação por Bearer token
├── routes/
│   ├── config.js          # GET/PATCH /api/config
│   ├── sons.js            # GET/PATCH /api/sons
│   ├── arena.js           # GET/PATCH /api/arena
│   ├── imagens.js         # Upload de bonecos e imagens estáticas
│   ├── filmes.js          # Config do modal de filmes
│   └── estado.js          # Export/import/reset completo
├── public/
│   └── index.html         # Painel admin (acessível em /admin)
├── uploads/
│   ├── bonecos/           # Bonecos da arena (arquivos enviados)
│   └── img/               # Imagens estáticas substituídas
└── .env.example
```

---

## 🚀 Deploy no Render

### 1. Crie um repositório no GitHub e faça push deste projeto

```bash
git init
git add .
git commit -m "roleta admin backend"
git remote add origin https://github.com/SEU_USUARIO/roleta-admin-backend.git
git push -u origin main
```

### 2. Crie um novo Web Service no Render

1. Acesse [render.com](https://render.com) → **New → Web Service**
2. Conecte o repositório
3. Configurações:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance**: Free (ou Starter para disco persistente)

### 3. Adicione as variáveis de ambiente no Render

| Variável | Valor |
|---|---|
| `ADMIN_SECRET` | Uma chave forte (ex: `openssl rand -hex 32`) |
| `FRONTEND_URL` | URL do seu GitHub Pages (ex: `https://seuusuario.github.io`) |
| `BACKEND_URL` | URL do serviço no Render (após criar, ex: `https://roleta-admin.onrender.com`) |

> ⚠️ **IMPORTANTE**: O disco do Render Free é efêmero — os uploads de imagens e o `data.json` são perdidos a cada deploy. Para persistência real, upgrade para o plano Starter + Persistent Disk, ou migre o storage para um bucket S3/Cloudinary.

---

## 🌐 Endpoints

### Público (sem autenticação)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Health check + lista de endpoints |
| GET | `/api/config` | Configurações gerais |
| GET | `/api/sons` | Config de sons |
| GET | `/api/arena` | Config da arena |
| GET | `/api/imagens/bonecos` | Lista bonecos |
| GET | `/api/imagens/estaticas` | Imagens estáticas atuais |
| GET | `/api/filmes/config` | Config do modal de filmes |
| GET | `/api/filmes/proxy` | Proxy para a API de filmes |

### Protegido (header `Authorization: Bearer <ADMIN_SECRET>`)
| Método | Rota | Descrição |
|---|---|---|
| PATCH | `/api/config` | Atualiza config geral |
| PATCH | `/api/sons` | Atualiza sons |
| PATCH | `/api/arena` | Atualiza arena |
| POST | `/api/imagens/bonecos` | Upload de bonecos (multipart, campo `files`) |
| DELETE | `/api/imagens/bonecos/:filename` | Remove boneco |
| POST | `/api/imagens/estaticas/:slot` | Upload de imagem estática (campo `file`) |
| DELETE | `/api/imagens/estaticas/:slot` | Reseta slot para original |
| PATCH | `/api/filmes/config` | Atualiza config de filmes |
| GET | `/api/estado` | Estado completo |
| PUT | `/api/estado` | Importa estado completo |
| POST | `/api/estado/reset` | Reset para padrões |

### Painel Admin
Acesse `https://seu-app.onrender.com/admin` no browser.
- Digite a `ADMIN_SECRET` e a URL do backend para entrar.

---

## 🔌 Integrar com o frontend (roleta no GitHub Pages)

No início do `script.js` ou `scrparena.js`, adicione algo como:

```js
const ADMIN_API = 'https://seu-app.onrender.com';

async function carregarConfigRemota() {
  try {
    const [cfg, arena, sons] = await Promise.all([
      fetch(`${ADMIN_API}/api/config`).then(r => r.json()),
      fetch(`${ADMIN_API}/api/arena`).then(r => r.json()),
      fetch(`${ADMIN_API}/api/sons`).then(r => r.json()),
    ]);
    // Aplicar configs...
    if (cfg.ok) aplicarConfig(cfg.data);
    if (arena.ok) aplicarArena(arena.data);
  } catch (e) {
    console.warn('Usando configs locais (backend offline):', e.message);
  }
}
carregarConfigRemota();
```

---

## 💻 Rodar localmente

```bash
cp .env.example .env
# edite .env com seus valores
npm install
npm run dev
```

Acesse: http://localhost:3001/admin
