// supabase-config.js
// Cliente Supabase para gerenciar armazenamento de imagens e sons
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️  Variáveis Supabase não configuradas. Storage desabilitado.");
  module.exports = null;
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Buckets
const BUCKETS = {
  IMAGES: process.env.SUPABASE_STORAGE_BUCKET_IMAGES || "images",
  SOUNDS: process.env.SUPABASE_STORAGE_BUCKET_SOUNDS || "sounds",
};

/**
 * Upload arquivo para Supabase
 * @param {string} bucketName - Nome do bucket ('images' ou 'sounds')
 * @param {string} fileName - Nome do arquivo
 * @param {Buffer} fileBuffer - Conteúdo do arquivo
 * @returns {Promise<{url: string, path: string}>}
 */
async function uploadFile(bucketName, fileName, fileBuffer) {
  if (!supabase) throw new Error("Supabase não configurado");

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, fileBuffer, {
      upsert: true, // Sobrescreve se existir
      contentType: getContentType(fileName),
    });

  if (error) throw new Error(`Erro upload: ${error.message}`);

  // URL pública do arquivo
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return {
    url: urlData.publicUrl,
    path: data.path,
    fileName: fileName,
  };
}

/**
 * Deletar arquivo do Supabase
 * @param {string} bucketName - Nome do bucket
 * @param {string} fileName - Nome do arquivo
 */
async function deleteFile(bucketName, fileName) {
  if (!supabase) throw new Error("Supabase não configurado");

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([fileName]);

  if (error) throw new Error(`Erro ao deletar: ${error.message}`);
  return { deleted: true, fileName };
}

/**
 * Listar todos os arquivos de um bucket
 * @param {string} bucketName - Nome do bucket
 * @returns {Promise<Array>}
 */
async function listFiles(bucketName) {
  if (!supabase) throw new Error("Supabase não configurado");

  const { data, error } = await supabase.storage
    .from(bucketName)
    .list("", { limit: 100, offset: 0, sortBy: { column: "created_at", order: "desc" } });

  if (error) throw new Error(`Erro ao listar: ${error.message}`);

  // Adicionar URLs públicas
  return data.map((file) => ({
    name: file.name,
    size: file.metadata?.size || 0,
    created_at: file.created_at,
    url: supabase.storage.from(bucketName).getPublicUrl(file.name).data.publicUrl,
  }));
}

/**
 * Obter URL pública de um arquivo
 * @param {string} bucketName - Nome do bucket
 * @param {string} fileName - Nome do arquivo
 * @returns {string}
 */
function getPublicUrl(bucketName, fileName) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Detectar tipo de conteúdo baseado na extensão
 */
function getContentType(fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
  };
  return types[ext] || "application/octet-stream";
}

module.exports = {
  supabase,
  BUCKETS,
  uploadFile,
  deleteFile,
  listFiles,
  getPublicUrl,
};
