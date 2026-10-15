// 드래곤 견적 서버: 정적 파일 + API
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* .env 없음 */ }

const { loadData, recommend, adjust } = await import('./engine.js');
const { searchSlot } = await import('./parts.js');
const { offers, resolveSkill } = await import('./danawa.js');
const { ask } = await import('./ai.js');
const { SLOTS, PURPOSES } = await import('./catalog.js');

const PUBLIC = path.join(ROOT, 'public');
const PORT = +process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}

const routes = {
  'GET /api/meta': async () => ({ slots: SLOTS, purposes: PURPOSES }),

  // 부품 종류별 목록 (최저가 → 최고가)
  'GET /api/parts': async (q) => {
    const slot = q.get('slot');
    if (!SLOTS.some((s) => s.key === slot)) throw new Error('알 수 없는 부품 종류');
    const term = (q.get('q') || '').trim();
    const list = term ? await searchSlot(slot, term) : (await loadData())[slot];
    return { slot, count: list.length, items: list };
  },

  // 한 제품의 쇼핑몰별 가격
  'GET /api/offers': async (q) => {
    const r = await offers(q.get('pcode'));
    return {
      title: r.title, url: r.source_url,
      offers: (r.offers || []).map((o) => ({
        mall: o.mall, price: o.price, total: o.total_price, shipping: o.shipping, free: o.is_free_shipping,
        condition: o.payment_condition_label || null, card: o.card_name ? `${o.card_name} ${o.card_price_text || ''}`.trim() : null,
        installment: o.installment || null, url: o.url,
      })),
    };
  },

  'POST /api/adjust': async (_q, b) => adjust(await loadData(), b.ids, b.slot, b.dir, +b.budget, b.purpose),

  'POST /api/ask': async (_q, b) => ask(b.history || [], b.build || null),
};

// 꿀조합: 부품 종류를 하나 모을 때마다 드래곤볼 이벤트를 흘려보낸다 (SSE)
async function wish(req, res, q) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const emit = (ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    const budget = Math.max(300000, Math.min(10000000, +q.get('budget') || 1500000));
    const picked = (q.get('purpose') || '').split(',').filter((k) => PURPOSES[k]);
    const purpose = picked.length ? picked : ['game'];
    const d = await loadData((slot, n) => emit('ball', { slot, count: n }));
    emit('done', recommend(d, budget, purpose));
  } catch (e) {
    emit('fail', { message: e.message });
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/wish') return wish(req, res, url.searchParams);
    const route = routes[`${req.method} ${url.pathname}`];
    if (route) {
      const b = req.method === 'POST' ? await body(req) : {};
      return send(res, 200, await route(url.searchParams, b));
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: '없는 API' });
    // 정적 파일
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🐉 드래곤 견적 실행 중 → http://localhost:${PORT}`);
  try { console.log('k-skill danawa:', resolveSkill()); } catch (e) { console.error(e.message); }
  // 첫 방문자가 오래 기다리지 않도록 미리 가격을 모아 둔다
  loadData((slot, n) => console.log(`  ✦ ${slot} ${n}개 수집`)).catch((e) => console.error('가격 수집 실패:', e.message));
});
