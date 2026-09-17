// Helper compartilhado pelas 3 functions (scrape/relatorio/dino): junta as
// chaves configuradas na tela de Configurações (Firestore, escrita pelo
// app) com as configuradas direto na Vercel (env vars) — Firestore tem
// prioridade, env var é o fallback. Cache de 5min pra não bater no
// Firestore a cada chamada.
//
// Precisa de FIREBASE_SERVICE_ACCOUNT (JSON da service account em base64)
// configurado na Vercel pra conseguir ler o Firestore. Sem isso, funciona
// só com as env vars normais (comportamento de antes).

import admin from 'firebase-admin';

let app;
function getAdmin() {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    app = admin.initializeApp({ credential: admin.credential.cert(json) });
    return app;
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT inválido:', e.message);
    return null;
  }
}

let cache = null;
let cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

export async function obterChaves() {
  const agora = Date.now();
  if (cache && agora - cacheAt < TTL_MS) return cache;

  let doc = {};
  const adminApp = getAdmin();
  if (adminApp) {
    try {
      const snap = await adminApp.firestore().collection('trec-social-radar-config').doc('chaves').get();
      doc = snap.exists ? snap.data() : {};
    } catch (e) {
      console.error('Falha lendo chaves do Firestore, usando só env vars:', e.message);
    }
  }

  cache = {
    APIFY_TOKEN: doc.APIFY_TOKEN || process.env.APIFY_TOKEN,
    APIFY_TOKEN_2: doc.APIFY_TOKEN_2 || process.env.APIFY_TOKEN_2,
    APIFY_TOKEN_3: doc.APIFY_TOKEN_3 || process.env.APIFY_TOKEN_3,
    APIFY_TOKEN_4: doc.APIFY_TOKEN_4 || process.env.APIFY_TOKEN_4,
    OPENAI_API_KEY: doc.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: doc.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  };
  cacheAt = agora;
  return cache;
}
