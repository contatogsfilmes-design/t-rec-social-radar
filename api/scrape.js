// Vercel Serverless Function — único lugar que conhece os tokens da Apify.
// Recebe { network, handle, days } do front, chama o ator certo na Apify
// via endpoint "run-sync-get-dataset-items" (roda e já devolve os itens,
// sem precisar dar polling), normaliza e devolve seguidores + seguindo +
// foto de perfil + média de views + top 3 posts do período pedido.
//
// Suporta várias chaves da Apify (APIFY_TOKEN, APIFY_TOKEN_2, _3, _4): se uma
// chave estiver sem crédito, tenta a próxima automaticamente.

export const config = { maxDuration: 60 };

const ACTORS = {
  instagram: 'apify~instagram-scraper',
  tiktok: 'clockworks~tiktok-scraper',
  youtube: 'streamers~youtube-scraper',
  facebook: 'apify~facebook-pages-scraper',
};

const CUSTO_ESTIMADO = {
  instagram: () => 0.003,
  tiktok: (n) => 0.003 + n * 0.0035,
  youtube: (n) => 0.003 + n * 0.0035,
  facebook: () => 0,
};

function tokensDisponiveis() {
  return [process.env.APIFY_TOKEN, process.env.APIFY_TOKEN_2, process.env.APIFY_TOKEN_3, process.env.APIFY_TOKEN_4].filter(Boolean);
}

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

const SEM_CREDITO = /usage|limit|balance|credit|payment|monthly/i;

async function callActor(actorId, input) {
  const tokens = tokensDisponiveis();
  if (!tokens.length) throw new Error('Nenhum APIFY_TOKEN configurado no Vercel.');

  let ultimoErro;
  for (let i = 0; i < tokens.length; i++) {
    const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${tokens[i]}`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const msg = Array.isArray(data) ? JSON.stringify(data) : data?.error?.message || `Apify respondeu ${resp.status}`;
        // 401/402 ou mensagem de limite/saldo -> tenta a próxima chave. Outros erros (perfil privado etc) não adianta trocar de chave.
        if (resp.status === 401 || resp.status === 402 || SEM_CREDITO.test(msg)) {
          ultimoErro = new Error(`chave ${i + 1}/${tokens.length} sem crédito: ${msg}`);
          continue;
        }
        throw new Error(msg);
      }
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.__naoTrocar) throw err;
      ultimoErro = err;
    }
  }
  throw ultimoErro || new Error('Todas as chaves da Apify falharam.');
}

function avg(nums) {
  const valid = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function topPosts(posts, n = 3) {
  return posts
    .filter((p) => typeof p.views === 'number')
    .sort((a, b) => b.views - a.views)
    .slice(0, n);
}

async function scrapeInstagram(handle) {
  const items = await callActor(ACTORS.instagram, {
    directUrls: [`https://www.instagram.com/${handle}/`],
    resultsType: 'details',
    resultsLimit: 1,
  });
  const perfil = items[0];
  if (!perfil) throw new Error('Perfil não encontrado ou privado.');
  const posts = (perfil.latestPosts || []).map((p) => ({
    url: p.url,
    thumb: p.displayUrl,
    views: p.videoViewCount ?? null,
    likes: p.likesCount ?? null,
    comments: p.commentsCount ?? null,
    legenda: (p.caption || '').slice(0, 140),
    date: p.timestamp,
  }));
  return {
    seguidores: perfil.followersCount ?? null,
    seguindo: perfil.followsCount ?? null,
    fotoPerfil: perfil.profilePicUrlHD || perfil.profilePicUrl || null,
    posts,
  };
}

async function scrapeTiktok(handle, limit) {
  const items = await callActor(ACTORS.tiktok, {
    profiles: [handle],
    resultsPerPage: limit,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });
  const autor = items[0]?.authorMeta;
  const posts = items.map((i) => ({
    url: i.webVideoUrl,
    thumb: i.videoMeta?.coverUrl,
    views: i.playCount ?? null,
    likes: i.diggCount ?? null,
    comments: i.commentCount ?? null,
    legenda: (i.text || '').slice(0, 140),
    date: i.createTimeISO,
  }));
  return {
    seguidores: autor?.fans ?? null,
    seguindo: autor?.following ?? null,
    fotoPerfil: autor?.avatar || null,
    posts,
  };
}

async function scrapeYoutube(handle, limit) {
  const items = await callActor(ACTORS.youtube, {
    startUrls: [{ url: `https://www.youtube.com/@${handle}` }],
    maxResults: limit,
  });
  const posts = items.map((i) => ({
    url: i.url,
    thumb: i.thumbnailUrl,
    views: i.viewCount ?? null,
    likes: i.likes ?? null,
    comments: i.commentsCount ?? null,
    legenda: (i.title || '').slice(0, 140),
    date: i.date,
  }));
  return {
    seguidores: items[0]?.numberOfSubscribers ?? null,
    seguindo: null, // canal do YouTube não tem "seguindo"
    fotoPerfil: items[0]?.channelAvatarUrl || null,
    posts,
  };
}

// As URLs de foto de perfil da Apify (Instagram/TikTok/Facebook) são
// assinadas e expiram (parâmetro "oe=" na URL) — se guardássemos só a URL,
// a foto pararia de aparecer depois de um tempo (e às vezes já falha na
// hora, por hotlink). Baixamos os bytes aqui no servidor e devolvemos como
// data URI: fica permanente e nunca depende de carregar de outro domínio.
async function baixarFotoComoDataUri(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const tipo = resp.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length > 500_000) return null; // foto gigante demais, ignora em vez de inchar o Firestore
    return `data:${tipo};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

async function scrapeFacebook(handle) {
  const url = handle.startsWith('http') ? handle : `https://www.facebook.com/${handle}`;
  const items = await callActor(ACTORS.facebook, { startUrls: [{ url }], resultsLimit: 1 });
  const pagina = items[0];
  if (!pagina) throw new Error('Página não encontrada.');
  return {
    seguidores: pagina.followers ?? pagina.likes ?? null,
    seguindo: pagina.followings ?? null,
    fotoPerfil: pagina.profilePictureUrl || null,
    posts: [],
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido' });

  const { network, handle, days = 30 } = req.body || {};
  if (!network || !handle) return res.status(400).json({ ok: false, error: 'Faltou network ou handle.' });
  if (!ACTORS[network]) return res.status(400).json({ ok: false, error: `Rede desconhecida: ${network}` });

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
    const fotoPerfil = await baixarFotoComoDataUri(resultado.fotoPerfil);

    return res.status(200).json({
      ok: true,
      network,
      handle: cleanHandle,
      seguidores: resultado.seguidores,
      seguindo: resultado.seguindo,
      fotoPerfil,
      mediaViews,
      postsNoPeriodo: postsNoPeriodo.length,
      totalPostsRetornados: resultado.posts.length,
      topPosts: topPosts(postsNoPeriodo),
      custoEstimadoUsd: CUSTO_ESTIMADO[network](limit),
      periodoDias: days,
      atualizadoEm: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({ ok: false, network, handle: cleanHandle, error: err.message });
  }
}
