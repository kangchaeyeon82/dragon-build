// 드래곤 견적 로컬 서버: 정적 파일 + /api/danawa + /api/ask
// (Vercel 배포에서는 api/ 폴더의 함수가 같은 주소를 맡는다)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch { /* .env 없음 */ }

const { search, offers } = await import('./danawa.js');
const { ask } = await import('./ai.js');

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const q = url.searchParams;
  try {
    if (url.pathname === '/api/danawa') {
      if (q.get('cmd') === 'search' && q.get('q')) return send(res, 200, await search(q.get('q').slice(0, 100)));
      if (q.get('cmd') === 'offers' && /^\d+$/.test(q.get('pcode') || '')) return send(res, 200, await offers(q.get('pcode')));
      return send(res, 400, { error: 'cmd=search&q=… 또는 cmd=offers&pcode=… 형식이어야 해요' });
    }
    if (url.pathname === '/api/ask' && req.method === 'POST') {
      const b = await body(req);
      return send(res, 200, await ask(b.history || [], b.build || null));
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: '없는 API' });
    // 정적 파일
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 502, { error: e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🐉 드래곤 견적 실행 중 → http://localhost:${PORT}`);
});
