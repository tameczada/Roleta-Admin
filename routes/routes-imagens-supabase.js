// routes/imagens-supabase.js
// Gerenciar imagens (bonecos da roleta) no Supabase
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
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens são permitidas (jpg, png, gif, webp)"));
    }
  },
});

/**
 * GET /api/imagens/supabase
 * Listar todas as imagens armazenadas no Supabase
 */
router.get("/supabase", async (req, res) => {
  try {
    const imagens = await listFiles(BUCKETS.IMAGES);
    res.json({
      ok: true,
      total: imagens.length,
      imagens: imagens.map((img) => ({
        name: img.name,
        size: img.size,
        url: img.url,
        created_at: img.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/imagens/supabase/upload
 * Upload de nova imagem para Supabase
 * Requer autenticação
 */
router.post("/supabase/upload", auth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado" });
    }

    // Gerar nome único para a imagem
    const timestamp = Date.now();
    const fileName = `${timestamp}-${req.file.originalname}`;

    // Upload para Supabase
    const result = await uploadFile(BUCKETS.IMAGES, fileName, req.file.buffer);

    res.json({
      ok: true,
      message: "Imagem enviada com sucesso",
      image: {
        name: result.fileName,
        url: result.url,
        path: result.path,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/imagens/supabase/:fileName
 * Deletar imagem do Supabase
 * Requer autenticação
 */
router.delete("/supabase/:fileName", auth, async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({ ok: false, error: "Nome do arquivo não fornecido" });
    }

    // Decodificar nome do arquivo (pode vir URL-encoded)
    const decodedFileName = decodeURIComponent(fileName);

    const result = await deleteFile(BUCKETS.IMAGES, decodedFileName);

    res.json({
      ok: true,
      message: "Imagem deletada com sucesso",
      deleted: result.deleted,
      fileName: decodedFileName,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * PATCH /api/imagens/supabase/:fileName
 * Atualizar/Substituir imagem (reupload)
 * Requer autenticação
 */
router.patch("/supabase/:fileName", auth, upload.single("image"), async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: "Nenhum arquivo enviado" });
    }

    const decodedFileName = decodeURIComponent(fileName);

    // Delete o arquivo antigo
    await deleteFile(BUCKETS.IMAGES, decodedFileName);

    // Upload da nova imagem com o mesmo nome
    const result = await uploadFile(BUCKETS.IMAGES, decodedFileName, req.file.buffer);

    res.json({
      ok: true,
      message: "Imagem atualizada com sucesso",
      image: {
        name: result.fileName,
        url: result.url,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
