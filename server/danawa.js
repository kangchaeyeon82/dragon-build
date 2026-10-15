// 다나와 조회 계층: k-skill danawa-price-search 스크립트를 파이썬으로 실행하고 결과를 캐시한다.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.join(here, 'danawa_ext.py');
const CACHE_FILE = path.join(here, '..', 'data', 'cache.json');
const TTL = 6 * 60 * 60 * 1000; // 6시간
const PYTHON = process.env.PYTHON || 'python';

let skillPath = process.env.DANAWA_SKILL_PATH || null;

export function resolveSkill() {
  if (skillPath && fs.existsSync(skillPath)) return skillPath;
  const out = execSync('npx -y @nomadamas/k-skill@0 path danawa-price-search scripts/danawa_search.py', {
    encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'ignore'],
  });
  skillPath = out.trim().split(/\r?\n/).pop().trim();
  if (!fs.existsSync(skillPath)) throw new Error('k-skill danawa 스크립트를 찾지 못했습니다: ' + skillPath);
  return skillPath;
}

// ---- 캐시 ----
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; }
let saveTimer = null;
function saveCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }, 500);
}

// ---- 동시 실행 제한 (다나와에 부담 주지 않도록) ----
const MAX_CONC = 3;
let running = 0;
const queue = [];
function limited(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      running++;
      try { resolve(await fn()); } catch (e) { reject(e); } finally {
        running--;
        if (queue.length) queue.shift()();
      }
    };
    running < MAX_CONC ? run() : queue.push(run);
  });
}

function runPy(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON, ['-I', '-X', 'utf8', EXT, resolveSkill(), ...args], { windowsHide: true });
    let out = '', err = '';
    p.stdout.setEncoding('utf8').on('data', (d) => (out += d));
    p.stderr.setEncoding('utf8').on('data', (d) => (err += d));
    const timer = setTimeout(() => p.kill(), 40000);
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().split('\n').pop() || 'danawa helper failed'));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('잘못된 응답')); }
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cached(key, fn, isEmpty) {
  const hit = cache[key];
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  let data, lastErr;
  // 다나와가 가끔 빈 페이지를 주므로 최대 3번 재시도
  for (let i = 0; i < 3; i++) {
    try {
      data = await limited(fn);
      if (!isEmpty(data)) break;
    } catch (e) { lastErr = e; }
    await sleep(1200 * (i + 1));
  }
  if (data && !isEmpty(data)) {
    cache[key] = { ts: Date.now(), data };
    saveCache();
    return data;
  }
  if (hit) return hit.data; // 만료된 캐시라도 있으면 사용
  if (lastErr) throw lastErr;
  return data;
}

export function search(query) {
  return cached('s:' + query, () => runPy(['search', query]), (d) => !d || !d.items || d.items.length === 0)
    .then((d) => d.items.map((it) => ({ ...it, maker: it.maker ? it.maker.replace(/<[^>]+>/g, '') : null })));
}

export function offers(pcode) {
  return cached('o:' + pcode, () => runPy(['offers', String(pcode), '--limit', '40']), (d) => !d || !d.offers);
}

export function cacheAge(query) {
  const hit = cache['s:' + query];
  return hit ? hit.ts : null;
}
