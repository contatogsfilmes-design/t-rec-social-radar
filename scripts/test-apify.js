// Testa os 3 atores da Apify (Instagram, TikTok, YouTube) contra perfis reais
// já conhecidos no cérebro, com limites baixos pra gastar pouco crédito.
// Rodar: npm run test:apify
// Precisa de um arquivo .env na raiz do projeto com APIFY_TOKEN=xxxx

import 'dotenv/config';
import { ApifyClient } from 'apify-client';

const token = process.env.APIFY_TOKEN;
if (!token) {
  console.error('Faltou o APIFY_TOKEN no .env. Crie o arquivo .env (baseado no .env.example) com seu token.');
  process.exit(1);
}

const client = new ApifyClient({ token });

async function runActor(actorId, input, label) {
  console.log(`\n=== ${label} (${actorId}) ===`);
  try {
    const run = await client.actor(actorId).call(input, { waitSecs: 120 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });
    console.log(`OK — ${items.length} item(ns) retornado(s). Primeiro item (resumido):`);
    console.dir(items[0], { depth: 3 });
    return items;
  } catch (err) {
    console.error(`FALHOU: ${err.message}`);
    return null;
  }
}

async function main() {
  // Instagram — perfil (seguidores)
  await runActor(
    'apify/instagram-scraper',
    { directUrls: ['https://www.instagram.com/betocarvalhoo/'], resultsType: 'details', resultsLimit: 1 },
    'Instagram — perfil/seguidores'
  );

  // Instagram — posts recentes (views)
  await runActor(
    'apify/instagram-scraper',
    { directUrls: ['https://www.instagram.com/betocarvalhoo/'], resultsType: 'posts', resultsLimit: 5 },
    'Instagram — posts recentes'
  );

  // TikTok — perfil + vídeos
  await runActor(
    'clockworks/tiktok-scraper',
    { profiles: ['betocarvalhoagro'], resultsPerPage: 5, shouldDownloadVideos: false, shouldDownloadCovers: false },
    'TikTok — perfil + vídeos'
  );

  // YouTube — canal + vídeos/shorts
  await runActor(
    'streamers/youtube-scraper',
    { startUrls: [{ url: 'https://www.youtube.com/@BETOCARVALHOo' }], maxResults: 5 },
    'YouTube — canal + vídeos'
  );
}

main();

// teste avulso: Facebook (rodar separado do main() acima se precisar)
