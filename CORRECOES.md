# Correção — Aba Sons: envio de várias músicas de uma vez

## A causa
Em `routes/musicas.js`, o upload de múltiplos arquivos enviava cada um para o
Supabase Storage **um atrás do outro, dentro de um loop**, e na primeira falha
(mesmo passageira, tipo uma soluço de rede) o pedido inteiro era abortado —
inclusive descartando as faixas que já tinham subido com sucesso antes dela.

Com 1 arquivo só, a chance dessa falha acontecer naquela hora é baixa e o envio
quase sempre passa. Com vários arquivos juntos, a chance de pelo menos 1 deles
esbarrar numa falha passageira sobe bastante — e aí o lote inteiro falhava,
dando a impressão de que "só funciona um por um".

(Reproduzi exatamente esse comportamento num teste: 3 músicas, uma falha de
rede isolada no meio → no código antigo, as 3 eram descartadas; com a
correção, 2 entram normalmente e só a que falhou é reportada.)

## O que mudou
- Cada arquivo agora é enviado **separado dos outros**: uma falha isolada não
  derruba mais os demais.
- Cada arquivo tentado **2 vezes** antes de desistir (cobre instabilidades
  passageiras de rede/Supabase).
- Os arquivos são enviados **em paralelo**, não mais um de cada vez — além de
  mais rápido, reduz a chance de esbarrar num timeout com lotes grandes.
- Se 1 ou 2 falharem mas o resto passar, as que deram certo são salvas mesmo
  assim, e a tela mostra exatamente quais falharam e por quê (em vez de só
  "não funciona").
- Arquivos de áudio com mimetype genérico (alguns `.m4a`/`.flac`/`.wav`
  dependendo do navegador/SO) deixam de ser rejeitados por engano — agora
  aceita por tipo OU por extensão conhecida.
- Botão "Enviar" fica desabilitado com "⏳ Enviando N arquivo(s)..." durante o
  envio, pra não clicar duas vezes.
- Apliquei a mesma correção na aba de **Bonecos** (`routes/imagens.js`), que
  tinha exatamente o mesmo problema no upload múltiplo.

## Testado
Rodei o backend com Supabase e Express simulados (sem rede neste ambiente) e
comparei lado a lado: o código original falha o lote inteiro com 1 falha
isolada; o código corrigido salva as que deram certo e só reporta a que
falhou. Também validei o fallback de extensão e a sintaxe do HTML/JS do
painel. O que não dá pra testar daqui é contra o Render/Supabase reais — vale
testar um envio de 3–4 músicas após o deploy.
