// Vercel Serverless Function — único lugar que conhece o APIFY_TOKEN.
// Recebe { network, handle, days } do front, chama o ator certo na Apify
// via endpoint "run-sync-get-dataset-items" (roda e já devolve os itens,
// sem precisar dar polling), normaliza e devolve seguidores + média de views
// do período pedido.

export const config = { maxDuration: 60 };

const ACTORS = {
  instagram: 'apify~instagram-scraper',
  tiktok: 'clockworks~tiktok-scraper',
  youtube: 'streamers~youtube-scraper',
  facebook: 'apify~facebook-pages-scraper',
};

// Custo aproximado por chamada, baseado em testes reais (ver histórico do projeto).
// É estimativa pra mostrar na UI — o saldo exato fica no console da Apify.
const CUSTO_ESTIMADO = {
  instagram: () => 0.003,
  tiktok: (n) => 0.003 + n * 0.0035,
  youtube: (n) => 0.003 + n * 0.0035,
  facebook: () => 0,
};

function itemLimitForDays(days) {
  if (days <= 7) return 10;
  if (days <= 14) return 15;
  if (days <= 30) return 30;
  return 40;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function callActor(actorId, input) {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await resp.json();
  if (!resp.ok) {
    const msg = Array.isArray(data) ? JSON.stringify(data) : data?.error?.message || `Apify respondeu ${resp.status}`;
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

function avg(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

async function scrapeInstagram(handle) {
  const items = await callActor(ACTORS.instagram, {
    directUrls: [`https://www.instagram.com/${handle}/`],
    resultsType: 'details',
    resultsLimit: 1,
  });
  const perfil = items[0];
  if (!perfil) throw new Error('Perfil não encontrado ou privado.');
  const posts = perfil.latestPosts || [];
  return { seguidores: perfil.followersCount ?? null, posts: posts.map((p) => ({ views: p.videoViewCount, date: p.timestamp })) };
}

async function scrapeTiktok(handle, limit) {
  const items = await callActor(ACTORS.tiktok, {
    profiles: [handle],
    resultsPerPage: limit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });
  const seguidores = items[0]?.authorMeta?.fans ?? null;
  return { seguidores, posts: items.map((i) => ({ views: i.playCount, date: i.createTimeISO })) };
}

async function scrapeYoutube(handle, limit) {
  const items = await callActor(ACTORS.youtube, {
    startUrls: [{ url: `https://www.youtube.com/@${handle}` }],
    maxResults: limit,
  });
  const seguidores = items[0]?.numberOfSubscribers ?? null;
  return { seguidores, posts: items.map((i) => ({ views: i.viewCount, date: i.date })) };
}

async function scrapeFacebook(handle) {
  const url = handle.startsWith('http') ? handle : `https://www.facebook.com/${handle}`;
  const items = await callActor(ACTORS.facebook, { startUrls: [{ url }], resultsLimit: 1 });
  const pagina = items[0];
  if (!pagina) throw new Error('Página não encontrada.');
  return { seguidores: pagina.followers ?? pagina.likes ?? null, posts: [] };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido' });

  const { network, handle, days = 30 } = req.body || {};
  if (!network || !handle) return res.status(400).json({ ok: false, error: 'Faltou network ou handle.' });
  if (!ACTORS[network]) return res.status(400).json({ ok: false, error: `Rede desconhecida: ${network}` });
  if (!process.env.APIFY_TOKEN) return res.status(500).json({ ok: false, error: 'APIFY_TOKEN não configurado no Vercel.' });

  const limit = itemLimitForDays(days);
  const cleanHandle = String(handle).trim().replace(/^@/, '');

  try {
    let resultado;
    if (network === 'instagram') resultado = await scrapeInstagram(cleanHandle);
    else if (network === 'tiktok') resultado = await scrapeTiktok(cleanHandle, limit);
    else if (network === 'youtube') resultado = await scrapeYoutube(cleanHandle, limit);
    else resultado = await scrapeFacebook(cleanHandle);

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const postsNoPeriodo = resultado.posts.filter((p) => p.date && new Date(p.date).getTime() >= cutoff);
    const mediaViews = avg(postsNoPeriodo.map((p) => p.views));

    return res.status(200).json({
      ok: true,
      network,
      handle: cleanHandle,
      seguidores: resultado.seguidores,
      mediaViews,
      postsNoPeriodo: postsNoPeriodo.length,
      totalPostsRetornados: resultado.posts.length,
      custoEstimadoUsd: CUSTO_ESTIMADO[network](limit),
      periodoDias: days,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({ ok: false, network, handle: cleanHandle, error: err.message });
  }
}
