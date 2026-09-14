// Testa a function api/scrape.js localmente, sem precisar do Vercel rodando.
import 'dotenv/config';
import handler from '../api/scrape.js';

function fakeRes() {
  const res = {
    _status: 200,
    status(code) { this._status = code; return this; },
    json(obj) { console.log(`[${this._status}]`, JSON.stringify(obj, null, 2)); return this; },
    setHeader() {},
    end() {},
  };
  return res;
}

async function test(network, handle, days) {
  console.log(`\n=== ${network} @${handle} (${days}d) ===`);
  await handler({ method: 'POST', body: { network, handle, days } }, fakeRes());
}

await test('instagram', 'betocarvalhoo', 30);
await test('tiktok', 'betocarvalhoagro', 14);
await test('youtube', 'BETOCARVALHOo', 30);
await test('facebook', 'profile.php?id=100068293766977', 30);
