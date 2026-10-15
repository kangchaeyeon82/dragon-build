// 가격 저장본 만들기: 내 컴퓨터에서 다나와 가격을 모아 lib/snapshot.json 으로 저장한다.
// Vercel 서버가 다나와에 막힐 때 이 저장본으로 대신 보여 준다.
//   npm run snapshot   →  저장 후 다시 배포하면 반영
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CPUS, GPUS, QUERIES } from '../public/shared/catalog.js';
import { search } from './danawa.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'lib', 'snapshot.json');

const queries = [...new Set([...CPUS.map((m) => m.q), ...GPUS.map((m) => m.q), ...Object.values(QUERIES).flat()])];
const entries = {};
let ok = 0;
for (const q of queries) {
  try {
    const d = await search(q);
    if (d?.items?.length) { entries['s:' + q] = d; ok++; }
    process.stdout.write(`\r${ok}/${queries.length} ${q}                    `);
  } catch (e) {
    console.log(`\n실패: ${q} — ${e.message}`);
  }
}
fs.writeFileSync(OUT, JSON.stringify({ created: new Date().toISOString(), entries }));
console.log(`\n저장 완료: ${OUT} (${ok}/${queries.length}개 검색어, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)}MB)`);
