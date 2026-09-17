// Vercel Serverless Function — o "Dino", assistente de IA da T-Rec Studio.
// Único lugar que conhece OPENAI_API_KEY / ANTHROPIC_API_KEY. Responde
// perguntas sobre os clientes usando os dados já carregados no painel
// (o front manda um resumo compacto junto da pergunta — não lê o Firestore
// direto, é stateless).
//
// Prioridade: usa Anthropic se ANTHROPIC_API_KEY estiver configurada,
// senão cai pra OpenAI. Se nenhuma estiver configurada, devolve erro claro.

import { obterChaves } from './_chaves.js';

export const config = { maxDuration: 30 };

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const SYSTEM_PROMPT = `Você é o Dino, o assistente de IA da T-Rec Studio (produtora de conteúdo cujo mascote é um T-Rex sorridente segurando uma câmera de vídeo). Você ajuda o Biel (dono da produtora) a acompanhar os clientes: Instagram, TikTok, YouTube e Facebook.

Responda em português do Brasil, direto, sem enrolação. Use os dados fornecidos no contexto (JSON com seguidores, views médias e os posts que mais performaram de cada cliente) pra responder perguntas concretas — cite números reais, nunca invente. Se a pergunta for sobre um dado que não está no contexto (ex: rede que ainda não foi atualizada), diga isso claramente e sugira clicar em "Atualizar" naquele cliente/rede no painel.`;

async function perguntarAnthropic(pergunta, contexto, historico, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: `${SYSTEM_PROMPT}\n\nDados atuais dos clientes (JSON):\n${JSON.stringify(contexto)}`,
      messages: [...historico, { role: 'user', content: pergunta }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Anthropic respondeu ${resp.status}`);
  return data.content?.[0]?.text?.trim() || '';
}

async function perguntarOpenAI(pergunta, contexto, historico, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\nDados atuais dos clientes (JSON):\n${JSON.stringify(contexto)}` },
        ...historico,
        { role: 'user', content: pergunta },
      ],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `OpenAI respondeu ${resp.status}`);
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido' });

  const { pergunta, contexto, historico = [] } = req.body || {};
  if (!pergunta) return res.status(400).json({ ok: false, error: 'Faltou a pergunta.' });

  try {
    const chaves = await obterChaves();
    let resposta;
    if (chaves.ANTHROPIC_API_KEY) resposta = await perguntarAnthropic(pergunta, contexto, historico, chaves.ANTHROPIC_API_KEY);
    else if (chaves.OPENAI_API_KEY) resposta = await perguntarOpenAI(pergunta, contexto, historico, chaves.OPENAI_API_KEY);
    else return res.status(200).json({ ok: false, error: 'Nenhuma IA configurada — configure em Configurações (⚙️).' });

    return res.status(200).json({ ok: true, resposta });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}
