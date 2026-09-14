// Vercel Serverless Function — único lugar que conhece a OPENAI_API_KEY.
// Recebe os dados já calculados do período (métricas + top posts + tarefas)
// e pede pra IA escrever um resumo narrativo curto, no estilo dos relatórios
// que o Biel já produz manualmente (direto, com números, foco em padrão que
// performou pra replicar). Se não tiver OPENAI_API_KEY configurada, devolve
// ok:false e o front simplesmente mostra o relatório sem o resumo em texto.

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

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido' });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({ ok: false, error: 'OPENAI_API_KEY não configurada no Vercel.' });
  }

  const { cliente, periodo, redes, tarefas } = req.body || {};
  if (!cliente || !periodo || !redes) {
    return res.status(400).json({ ok: false, error: 'Faltou cliente, periodo ou redes no corpo da requisição.' });
  }

  try {
    const prompt = montarPrompt({ cliente, periodo, redes, tarefas });
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || `OpenAI respondeu ${resp.status}`);

    return res.status(200).json({ ok: true, resumo: data.choices?.[0]?.message?.content?.trim() || '' });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
}
