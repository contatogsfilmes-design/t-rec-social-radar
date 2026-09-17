// Vercel Serverless Function — único lugar que conhece OPENAI_API_KEY /
// ANTHROPIC_API_KEY. Recebe os dados já calculados do período (métricas +
// top posts + tarefas) e pede pra IA escrever um resumo narrativo curto, no
// estilo dos relatórios que o Biel já produz manualmente (direto, com
// números, foco em padrão que performou pra replicar). Prioriza Anthropic
// se configurada (melhor qualidade), senão usa OpenAI. Se nenhuma estiver
// configurada, devolve ok:false e o front mostra o relatório sem o resumo.

import { obterChaves } from './_chaves.js';

export const config = { maxDuration: 30 };

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function montarPrompt({ cliente, periodo, redes, tarefas }) {
  const linhasRedes = Object.entries(redes)
    .filter(([, r]) => r && r.seguidores !== null && r.seguidores !== undefined)
    .map(([rede, r]) => {
      const top = (r.topPosts || [])
        .map((p, i) => `    ${i + 1}. ${p.legenda || '(sem legenda)'} — ${p.views ?? '?'} views, ${p.likes ?? '?'} likes`)
        .join('\n');
      return `- ${rede}: ${r.seguidores} seguidores${r.mediaViews ? `, média de ${r.mediaViews} views/post (${r.postsNoPeriodo} posts no período)` : ''}\n${top}`;
    })
    .join('\n');

  const feitas = (tarefas?.feitas || []).map((t) => `- [feito] ${t.texto}`).join('\n');
  const pendentes = (tarefas?.pendentes || []).map((t) => `- [pendente] ${t.texto}`).join('\n');

  return `Você escreve relatórios mensais de performance de redes sociais pra uma produtora de conteúdo (T-Rec Studio) apresentar aos próprios clientes. Tom: direto, com números, sem enrolação, focado em identificar o que funcionou pra repetir. Português do Brasil.

Cliente: ${cliente.nome}
Período: ${periodo.inicio} a ${periodo.fim}

Métricas por rede:
${linhasRedes || '(sem dados)'}

Tarefas do período:
${feitas || '(nenhuma concluída registrada)'}
${pendentes || '(nenhuma pendente registrada)'}

Escreva um resumo de 3 a 5 parágrafos curtos: (1) panorama geral de crescimento/resultado, (2) qual conteúdo/formato performou melhor e por quê (baseado nos top posts), (3) o que ficou pendente e pode virar prioridade do próximo período. Não invente números que não foram passados.`;
}

async function chamarAnthropic(prompt, apiKey) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Anthropic respondeu ${resp.status}`);
  return data.content?.[0]?.text?.trim() || '';
}

async function chamarOpenAI(prompt, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5 }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `OpenAI respondeu ${resp.status}`);
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido' });

  const chaves = await obterChaves();
  if (!chaves.ANTHROPIC_API_KEY && !chaves.OPENAI_API_KEY) {
    return res.status(200).json({ ok: false, error: 'Nenhuma IA configurada (Anthropic ou OpenAI) — configure em Configurações.' });
  }

  const { cliente, periodo, redes, tarefas } = req.body || {};
  if (!cliente || !periodo || !redes) {
    return res.status(400).json({ ok: false, error: 'Faltou cliente, periodo ou redes no corpo da requisição.' });
  }

  try {
    const prompt = montarPrompt({ cliente, periodo, redes, tarefas });
    const resumo = chaves.ANTHROPIC_API_KEY
      ? await chamarAnthropic(prompt, chaves.ANTHROPIC_API_KEY)
      : await chamarOpenAI(prompt, chaves.OPENAI_API_KEY);

    return res.status(200).json({ ok: true, resumo });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}
