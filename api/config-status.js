// Vercel Serverless Function — devolve só SE cada chave está configurada
// (true/false), nunca o valor. Existe pra tela de Configurações mostrar
// "✓ já configurada" em vez de parecer que sumiu tudo toda vez que a
// página recarrega (o Firestore em si é write-only pro cliente, de
// propósito — ver firestore.rules).

import { obterChaves } from './_chaves.js';

export const config = { maxDuration: 15 };

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const chaves = await obterChaves();
  const status = Object.fromEntries(Object.entries(chaves).map(([k, v]) => [k, Boolean(v)]));
  return res.status(200).json({ ok: true, status });
}
