// routes/sons-supabase.js
// Gerenciar sons/áudios (música de fundo, efeitos) no Supabase
const express = require("express");
const multer = require("multer");
const path = require("path");
const { uploadFile, deleteFile, listFiles, BUCKETS } = require("../supabase-config");
const auth = require("../middleware/auth");

const router = express.Router();

// Configurar multer para armazenamento em memória
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (limite Supabase free)
  fileFilter: (req, file, cb) => {
    const allowed = /\.(mp3|wav|ogg|m4a|webm)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Apenas áudios são permitidos (mp3, wav, ogg, m4a, webm)"));
    }
  },
});

/**
 * GET /api/sons/supabase
 * Listar todos os sons armazenados no Supabase
 * Retorna playlist completa com URLs
 */
router.get("/supabase", async (req, res) => {
  try {
    const sons = await listFiles(BUCKETS.SOUNDS);

    // Organizar por categoria (opcional, baseado no nome do arquivo)
    const playlist = {
      musicas: [],
      efeitos: [],
      todos: sons,
    };

    sons.forEach((som) => {
      const item = {
        name: som.name,
        displayName: som.name.replace(/\d+-/, "").replace(/\.[^/.]+$/, ""), // Remove timestamp
        size: som.size,
        url: som.url,
        created_at: som.created_at,
      };

      // Categorizar por padrão no nome
      if (som.name.includes("efeito") || som.name.includes("effect")) {
        playlist.efeitos.push(item);
      } else {
        playlist.musicas.push(item);
      }
    });

    res.json({
      ok: true,
      total: sons.length,
      playlist,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/sons/supabase/upload
 * Upload de novo som para Supabase
 * Query params: type=musica|efeito (opcional, para ajudar na categorização)
 * Requer autenticação
 */
router.post("/supabase/upload", auth, upload.single("sound"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado" });
    }

    // Gerar nome único para o som
    const timestamp = Date.now();
    const type = req.query.type || "musica"; // musica ou efeito
    const fileName = `${type}-${timestamp}-${req.file.originalname}`;

    // Upload para Supabase
    const result = await uploadFile(BUCKETS.SOUNDS, fileName, req.file.buffer);

    res.json({
      ok: true,
      message: "Som enviado com sucesso",
      sound: {
        name: result.fileName,
        url: result.url,
        type: type,
        size: req.file.size,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/sons/supabase/:fileName
 * Deletar som do Supabase
 * Requer autenticação
 */
router.delete("/supabase/:fileName", auth, async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({ ok: false, error: "Nome do arquivo não fornecido" });
    }

    const decodedFileName = decodeURIComponent(fileName);

    const result = await deleteFile(BUCKETS.SOUNDS, decodedFileName);

    res.json({
      ok: true,
      message: "Som deletado com sucesso",
      deleted: result.deleted,
      fileName: decodedFileName,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PATCH /api/sons/supabase/:fileName
 * Atualizar/Substituir som (reupload)
 * Requer autenticação
 */
router.patch("/supabase/:fileName", auth, upload.single("sound"), async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado" });
    }

    const decodedFileName = decodeURIComponent(fileName);

    // Delete o arquivo antigo
    await deleteFile(BUCKETS.SOUNDS, decodedFileName);

    // Upload do novo som com o mesmo nome
    const result = await uploadFile(BUCKETS.SOUNDS, decodedFileName, req.file.buffer);

    res.json({
      ok: true,
      message: "Som atualizado com sucesso",
      sound: {
        name: result.fileName,
        url: result.url,
        size: req.file.size,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
