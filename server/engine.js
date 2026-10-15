// 꿀조합 엔진: 예산·용도 → 가성비 최적 조합, 부품 업/다운, 호환성 체크, 체감 성능
import { CPUS, GPUS, SLOTS, PURPOSES } from './catalog.js';
import { loadSlot } from './parts.js';

const ORDER = ['cpu', 'board', 'ram', 'gpu', 'ssd', 'psu', 'case', 'cooler'];

// ---- 데이터 로드 (진행 상황 콜백: 부품 종류 하나 끝날 때마다) ----
let DATA = null;
let DATA_TS = 0;
let loading = null;

export async function loadData(onProgress = () => {}, force = false) {
  if (DATA && !force && Date.now() - DATA_TS < 30 * 60 * 1000) {
    ORDER.forEach((k) => onProgress(k, DATA[k].length));
    return DATA;
  }
  if (!loading) {
    const listeners = new Set();
    loading = { listeners, promise: null };
    loading.promise = (async () => {
      const d = {};
      await Promise.all(ORDER.map(async (k) => {
        // 꿀조합에는 3곳 이상에서 파는 제품만 쓴다 (미끼·오류 가격 제외)
        d[k] = (await loadSlot(k).catch(() => [])).filter((p) => p.malls >= 3);
        listeners.forEach((fn) => fn(k, d[k].length));
      }));
      dropOutliers(d.ram, (p) => p.attrs.type + p.attrs.per);
      dropOutliers(d.ssd, (p) => Math.round((p.attrs.gb || 0) / 500));
      DATA = d; DATA_TS = Date.now();
      return d;
    })().finally(() => { loading = null; });
  }
  const l = loading;
  l.listeners.add(onProgress);
  try { return await l.promise; } finally { l.listeners.delete(onProgress); }
}

// 같은 용량인데 시세의 절반도 안 되는 가격은 미끼·오류 등록일 가능성이 높아 뺀다
function dropOutliers(list, keyFn) {
  const groups = new Map();
  for (const p of list) { const k = keyFn(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p.price); }
  const median = new Map([...groups].map(([k, v]) => { v.sort((a, b) => a - b); return [k, v[Math.floor(v.length / 2)]]; }));
  for (let i = list.length - 1; i >= 0; i--) {
    const m = median.get(keyFn(list[i]));
    if (groups.get(keyFn(list[i])).length >= 3 && list[i].price < m * 0.55) list.splice(i, 1);
  }
}

// ---- 옵션 테이블 ----
function cheapestBy(list, keyFn) {
  const m = new Map();
  for (const p of list) {
    const k = keyFn(p);
    if (k == null) continue;
    if (!m.has(k) || m.get(k).price > p.price) m.set(k, p);
  }
  return m;
}

function cpuOptions(d) {
  const best = cheapestBy(d.cpu, (p) => p.modelId);
  return CPUS.filter((m) => best.has(m.id)).map((m) => ({ model: m, part: best.get(m.id), price: best.get(m.id).price }));
}

function gpuOptions(d) {
  const best = cheapestBy(d.gpu, (p) => p.modelId);
  const list = GPUS.filter((m) => best.has(m.id)).map((m) => ({ model: m, part: best.get(m.id), price: best.get(m.id).price }));
  return [{ model: { id: 'none', name: '내장그래픽', vram: 0, score: 0, watt: 0, psu: 450 }, part: null, price: 0 }, ...list];
}

// 램: (DDR종류, 총 용량)별 최저 구성. 듀얼채널(2개)을 우선한다.
function ramOptions(d) {
  const opts = [];
  for (const type of ['DDR4', 'DDR5']) {
    for (const total of [16, 32, 64]) {
      const cands = [];
      for (const p of d.ram) {
        const a = p.attrs;
        if (a.type !== type || !a.per) continue;
        if (a.count >= 2 && a.total === total) cands.push({ part: p, qty: 1, price: p.price });
        if (a.count === 1 && a.per * 2 === total) cands.push({ part: p, qty: 2, price: p.price * 2 });
      }
      cands.sort((a, b) => a.price - b.price);
      if (cands[0]) opts.push({ type, total, ...cands[0] });
    }
  }
  return opts;
}

function ssdOptions(d) {
  const tier = (gb) => (gb >= 3800 ? 4000 : gb >= 1900 ? 2000 : gb >= 960 ? 1000 : gb >= 480 ? 500 : null);
  const best = cheapestBy(d.ssd, (p) => tier(p.attrs.gb));
  return [...best.entries()].map(([gb, part]) => ({ gb, part, price: part.price })).sort((a, b) => a.gb - b.gb);
}

const boardsFor = (d, cpu) => d.board.filter((b) => b.attrs.socket === cpu.socket && b.attrs.mem === cpu.mem);

function psuNeed(cpu, gpu) {
  const est = Math.ceil(((cpu?.tdp || 65) * 1.2 + (gpu?.watt || 0) + 100) / 50) * 50;
  return Math.max(gpu?.psu || 450, est, 500);
}
const psusFor = (d, need) => d.psu.filter((p) => p.attrs.watt >= need && p.attrs.grade >= (need >= 700 ? 4 : 2));

function coolerNeed(cpu) { return cpu.tdp >= 150 ? 250 : cpu.tdp >= 120 ? 200 : 150; }
const coolersFor = (d, cpu) => d.cooler.filter((c) => c.attrs.tdp >= coolerNeed(cpu));

const casesFor = (d, gpuLen, coolerH) => d.case.filter((c) => c.attrs.vga >= (gpuLen || 0) + 10 && c.attrs.coolerH >= (coolerH || 0));

// ---- 용도별 만족도 ----
const RAM_BONUS = { game: { 16: 0, 32: 4, 64: 5 }, edit: { 16: -12, 32: 6, 64: 12 }, ai: { 16: -6, 32: 4, 64: 9 }, office: { 16: 3, 32: 5, 64: 5 } };
const SSD_BONUS = { game: { 500: -4, 1000: 0, 2000: 3, 4000: 4 }, edit: { 500: -8, 1000: 0, 2000: 5, 4000: 7 }, ai: { 500: -5, 1000: 0, 2000: 3, 4000: 4 }, office: { 500: -1, 1000: 0, 2000: 1, 4000: 1 } };

function utility(purpose, cpu, gpu, ramTotal, ssdGb) {
  const g = gpu.score, ram = RAM_BONUS[purpose][ramTotal] ?? 0, ssd = SSD_BONUS[purpose][ssdGb] ?? 0;
  if (purpose === 'game') {
    if (gpu.id === 'none') return -Infinity;
    // 게임은 그래픽카드가 대부분을 결정하고, CPU는 그래픽카드를 받쳐 줄 만큼만 의미가 있다
    return 0.8 * Math.min(g, cpu.game * 1.6) + 0.2 * Math.min(cpu.game, g + 25) + ram + ssd;
  }
  if (purpose === 'edit') {
    const qsv = cpu.igpu && cpu.socket.startsWith('LGA') ? 4 : 0;
    return 0.55 * cpu.multi + 0.25 * Math.min(g, 100) + qsv + ram + ssd;
  }
  if (purpose === 'ai') {
    return 0.15 * cpu.multi + 0.45 * g + 2.2 * Math.min(gpu.vram, 32) + ram + ssd;
  }
  return 0.5 * Math.min(cpu.multi, 60) + 0.1 * Math.min(g, 40) + (gpu.id === 'none' ? 2 : 0) + ram + ssd;
}

// ---- 조합 조립 ----
function assemble(d, cpuOpt, gpuOpt, ramOpt, ssdOpt) {
  const cpu = cpuOpt.model, gpu = gpuOpt.model;
  if (gpu.id === 'none' && !cpu.igpu) return null;
  const board = boardsFor(d, cpu)[0];
  const psu = psusFor(d, psuNeed(cpu, gpu))[0];
  const cooler = coolersFor(d, cpu)[0];
  if (!board || !psu || !cooler) return null;
  const kase = casesFor(d, gpuOpt.part?.attrs.length, cooler.attrs.height)[0];
  if (!kase) return null;
  const parts = {
    cpu: { part: cpuOpt.part, qty: 1 }, board: { part: board, qty: 1 }, ram: { part: ramOpt.part, qty: ramOpt.qty },
    gpu: gpuOpt.part ? { part: gpuOpt.part, qty: 1 } : null, ssd: { part: ssdOpt.part, qty: 1 },
    psu: { part: psu, qty: 1 }, case: { part: kase, qty: 1 }, cooler: { part: cooler, qty: 1 },
  };
  return parts;
}

const total = (parts) => Object.values(parts).reduce((s, x) => s + (x ? x.part.price * x.qty : 0), 0);

// 목적 여러 개를 고르면 각 목적 만족도의 평균으로 판단한다 (게임이 들어가면 그래픽카드 필수)
const asList = (p) => (Array.isArray(p) ? p : [p]).filter((x) => PURPOSES[x]);
function utilityMulti(purposes, cpu, gpu, ramTotal, ssdGb) {
  let sum = 0;
  for (const p of purposes) {
    const u = utility(p, cpu, gpu, ramTotal, ssdGb);
    if (u === -Infinity) return u;
    sum += u;
  }
  return sum / purposes.length;
}

export function recommend(d, budget, purpose) {
  purpose = asList(purpose);
  const cpus = cpuOptions(d), gpus = gpuOptions(d), rams = ramOptions(d), ssds = ssdOptions(d);
  const cands = [];
  for (const c of cpus) for (const g of gpus) for (const r of rams) {
    if (r.type !== c.model.mem) continue;
    for (const s of ssds) {
      const parts = assemble(d, c, g, r, s);
      if (!parts) continue;
      const price = total(parts);
      const u = utilityMulti(purpose, c.model, g.model, r.total, s.gb);
      if (u === -Infinity) continue;
      cands.push({ parts, price, u });
    }
  }
  if (!cands.length) throw new Error('가격 정보를 아직 충분히 모으지 못했어요. 잠시 후 다시 시도해 주세요.');
  const within = cands.filter((c) => c.price <= budget * 1.03);
  let pick, overBudget = false;
  if (within.length) {
    const umax = Math.max(...within.map((c) => c.u));
    // 최고 만족도에 거의 근접한 조합 중 가장 싼 것 = 꿀조합
    pick = within.filter((c) => c.u >= umax - 2).sort((a, b) => a.price - b.price)[0];
  } else {
    overBudget = true;
    pick = cands.sort((a, b) => a.price - b.price)[0];
  }
  return describe(d, pick.parts, budget, purpose, { overBudget });
}

// ---- 업/다운: 한 부품만 한 단계 바꾸고 나머지 호환성 자동 맞춤 ----
export function adjust(d, ids, slot, dir, budget, purpose) {
  purpose = asList(purpose);
  const parts = fromIds(d, ids);
  const steps = alternatives(d, parts, slot);
  const curKey = stepKey(slot, parts[slot]);
  let i = steps.findIndex((s) => s.key === curKey);
  if (i < 0) i = 0;
  const next = steps[i + (dir === 'up' ? 1 : -1)];
  if (!next) return { ...describe(d, parts, budget, purpose), notice: dir === 'up' ? '이미 가장 좋은 단계예요.' : '이미 가장 저렴한 단계예요.' };
  parts[slot] = next.value;
  repair(d, parts, slot);
  return describe(d, parts, budget, purpose);
}

function fromIds(d, ids) {
  const parts = {};
  for (const k of ORDER) {
    const v = ids[k];
    if (!v) { parts[k] = null; continue; }
    const part = d[k].find((p) => p.id === v.id);
    if (!part) throw new Error('가격 정보가 갱신되어 조합을 다시 찾아야 해요. "소원 빌기"를 다시 눌러 주세요.');
    parts[k] = { part, qty: v.qty || 1 };
  }
  return parts;
}

const modelOf = (p) => (p ? (p.slot === 'cpu' ? CPUS : GPUS).find((m) => m.id === p.modelId) : null);

function stepKey(slot, x) {
  if (!x) return 'none';
  if (slot === 'cpu' || slot === 'gpu') return x.part.modelId;
  if (slot === 'ram') return x.part.attrs.type + (x.part.attrs.count > 1 ? x.part.attrs.total : x.part.attrs.per * x.qty);
  if (slot === 'ssd') return 'gb' + tierGb(x.part.attrs.gb);
  return x.part.id;
}
const tierGb = (gb) => (gb >= 3800 ? 4000 : gb >= 1900 ? 2000 : gb >= 960 ? 1000 : 500);

function alternatives(d, parts, slot) {
  const cpu = modelOf(parts.cpu.part);
  const gpuM = modelOf(parts.gpu?.part);
  if (slot === 'cpu') return cpuOptions(d).sort((a, b) => a.price - b.price).map((o) => ({ key: o.model.id, value: { part: o.part, qty: 1 } }));
  if (slot === 'gpu') return gpuOptions(d).filter((o) => o.part || cpu.igpu).sort((a, b) => a.price - b.price)
    .map((o) => ({ key: o.part ? o.model.id : 'none', value: o.part ? { part: o.part, qty: 1 } : null }));
  if (slot === 'ram') return ramOptions(d).filter((o) => o.type === cpu.mem).map((o) => ({ key: o.type + o.total, value: { part: o.part, qty: o.qty } }));
  if (slot === 'ssd') return ssdOptions(d).map((o) => ({ key: 'gb' + o.gb, value: { part: o.part, qty: 1 } }));
  const list = slot === 'board' ? boardsFor(d, cpu)
    : slot === 'psu' ? psusFor(d, psuNeed(cpu, gpuM))
    : slot === 'cooler' ? coolersFor(d, cpu)
    : casesFor(d, parts.gpu?.part.attrs.length, parts.cooler?.part.attrs.height);
  // 같은 제품 색상 차이 등은 하나로
  const seen = new Set();
  return list.filter((p) => { const k = p.name; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((p) => ({ key: p.id, value: { part: p, qty: 1 } }));
}

function repair(d, parts, changed) {
  const cpu = modelOf(parts.cpu.part);
  const gpuM = modelOf(parts.gpu?.part);
  const fix = (slot, ok, pick) => { if (!parts[slot] || !ok(parts[slot].part)) { const p = pick(); if (p) parts[slot] = p; } };
  fix('board', (b) => b.attrs.socket === cpu.socket && b.attrs.mem === cpu.mem, () => ({ part: boardsFor(d, cpu)[0], qty: 1 }));
  if (parts.ram.part.attrs.type !== cpu.mem) {
    const want = parts.ram.part.attrs.per * parts.ram.qty * (parts.ram.part.attrs.count || 1);
    const opts = ramOptions(d).filter((o) => o.type === cpu.mem);
    const o = opts.find((x) => x.total === want) || opts[0];
    if (o) parts.ram = { part: o.part, qty: o.qty };
  }
  if (!parts.gpu && !cpu.igpu) {
    const g = gpuOptions(d).find((o) => o.part);
    if (g) parts.gpu = { part: g.part, qty: 1 };
  }
  const need = psuNeed(cpu, modelOf(parts.gpu?.part) || gpuM);
  fix('psu', (p) => p.attrs.watt >= need, () => ({ part: psusFor(d, need)[0], qty: 1 }));
  fix('cooler', (c) => c.attrs.tdp >= coolerNeed(cpu), () => ({ part: coolersFor(d, cpu)[0], qty: 1 }));
  if (changed !== 'case') {
    fix('case', (c) => c.attrs.vga >= (parts.gpu?.part.attrs.length || 0) + 10 && c.attrs.coolerH >= (parts.cooler?.part.attrs.height || 0),
      () => ({ part: casesFor(d, parts.gpu?.part.attrs.length, parts.cooler?.part.attrs.height)[0], qty: 1 }));
  }
}

// ---- 결과 설명 (호환성, 체감 성능, 이유) ----
const stars = (v, steps) => Math.max(1, Math.min(5, 1 + steps.filter((s) => v >= s).length));

function performance(cpu, gpu, ramTotal) {
  const gEff = gpu.id === 'none' ? (cpu.igpu ? 8 : 0) : Math.min(gpu.score, cpu.game * 1.8);
  const editScore = cpu.multi + (ramTotal >= 32 ? 10 : -5) + (ramTotal >= 64 ? 5 : 0) + Math.min(gpu.score, 100) * 0.15;
  return [
    { key: 'office', label: '사무·인강·웹서핑', stars: 5, note: '어떤 조합이든 쾌적해요' },
    { key: 'fhd', label: 'FHD 게임 (배그·롤)', stars: stars(gEff, [20, 36, 46, 56]), note: gEff >= 46 ? '고옵션도 부드러워요' : gEff >= 20 ? '옵션을 낮추면 할 만해요' : '가벼운 게임 위주로 추천' },
    { key: 'qhd', label: 'QHD 고사양 게임', stars: stars(gEff, [36, 46, 60, 80]), note: gEff >= 80 ? '고주사율까지 넉넉해요' : gEff >= 56 ? '중상옵션 쾌적' : '옵션 타협이 필요해요' },
    { key: 'edit', label: '영상 편집', stars: stars(editScore, [40, 55, 70, 88]), note: editScore >= 88 ? '4K 편집도 시원시원' : editScore >= 70 ? 'FHD~4K 컷 편집 원활' : editScore >= 55 ? 'FHD 편집 원활' : '간단한 편집 위주' },
    { key: 'ai', label: 'AI·로컬 LLM', stars: stars(gpu.vram, [8, 12, 16, 24]), note: gpu.vram >= 16 ? '중형 AI 모델까지 OK' : gpu.vram >= 8 ? '작은 모델·이미지 생성 가능' : '그래픽카드가 필요해요' },
  ];
}

function reasons(slot, parts, cpu, gpu, purposes) {
  const has = (k) => purposes.includes(k);
  const p = parts[slot];
  if (slot === 'gpu' && !p) return '내장그래픽으로 화면을 출력해요. 사무·인강용으론 충분하고 비용을 크게 아껴요.';
  if (!p) return '';
  const a = p.part.attrs;
  switch (slot) {
    case 'cpu':
      if (has('edit')) return `${cpu.cores}로 인코딩·렌더링을 빠르게 처리해요.` + (cpu.igpu && cpu.socket.startsWith('LGA') ? ' 영상 가속(퀵싱크) 기능도 들어 있어요.' : '');
      if (has('game')) return cpu.id.includes('x3d') ? '게임에 특화된 대용량 캐시(3D V-Cache) CPU예요.' : '그래픽카드 성능을 충분히 받쳐 주는 급이에요.';
      if (has('ai')) return `${cpu.cores}로 데이터 처리·코딩 빌드를 받쳐 줘요.`;
      return '문서·웹·인강엔 넉넉하고 전기도 적게 먹어요.';
    case 'board': return `CPU 소켓(${a.socket})과 램 규격(${a.mem})이 딱 맞는 가성비 보드예요.`;
    case 'ram': {
      const t = a.count > 1 ? a.total : a.per * p.qty;
      return `${t}GB — ` + (t >= 64 ? '4K 편집·AI 작업도 여유로워요.' : t >= 32 ? '편집·게임·멀티태스킹에 넉넉해요.' : '일반 용도와 게임엔 충분해요.') + (p.qty === 2 || a.count >= 2 ? ' 2개를 꽂아 속도가 2배(듀얼채널)예요.' : '');
    }
    case 'gpu':
      if (has('ai')) return `VRAM ${gpu.vram}GB — AI 모델을 올리는 공간이 ${gpu.vram >= 16 ? '넉넉해요' : '조금 빠듯해요'}.`;
      if (has('edit')) return gpu.brand === 'NVIDIA' ? '프리미어·다빈치의 GPU 가속(쿠다·NVENC)을 잘 지원해요.' : '편집 가속과 출력에 충분한 성능이에요.';
      return '게임 화면을 그리는 핵심 부품이라 예산을 가장 많이 썼어요.';
    case 'ssd': return `NVMe 고속 SSD라 부팅·로딩이 몇 초면 끝나요.`;
    case 'psu': return `이 조합에 필요한 전력(약 ${psuNeed(cpu, gpu)}W) 대비 여유 있는 용량이에요.`;
    case 'case': return `그래픽카드(${parts.gpu?.part.attrs.length || '—'}mm)와 쿨러가 문제없이 들어가요.`;
    case 'cooler': return `CPU 발열을 넉넉히 식혀서 소음과 온도를 낮춰요.`;
  }
  return '';
}

function compat(parts, cpu, gpu) {
  const b = parts.board.part.attrs, r = parts.ram.part.attrs, psu = parts.psu.part.attrs;
  const kase = parts.case.part.attrs, cool = parts.cooler.part.attrs;
  const gpuLen = parts.gpu?.part.attrs.length || 0;
  const need = psuNeed(cpu, gpu);
  return [
    { label: 'CPU ↔ 메인보드 소켓', ok: b.socket === cpu.socket, detail: `${cpu.socket} = ${b.socket}` },
    { label: '메인보드 ↔ 램 규격', ok: b.mem === r.type, detail: `${b.mem} = ${r.type}` },
    { label: '파워 용량', ok: psu.watt >= need, detail: `필요 약 ${need}W · 파워 ${psu.watt}W` },
    { label: '그래픽카드 ↔ 케이스 길이', ok: !gpuLen || kase.vga >= gpuLen + 10, detail: gpuLen ? `${gpuLen}mm / 최대 ${kase.vga}mm` : '내장그래픽 사용' },
    { label: 'CPU 쿨러 성능·높이', ok: cool.tdp >= coolerNeed(cpu) && (cool.water || kase.coolerH >= cool.height), detail: cool.water ? `수랭 · 발열 ${cool.tdp}W 감당` : `${cool.height}mm / 최대 ${kase.coolerH}mm` },
    { label: '화면 출력', ok: !!parts.gpu || cpu.igpu, detail: parts.gpu ? '그래픽카드 사용' : '내장그래픽 사용' },
  ];
}

export function describe(d, parts, budget, purpose, extra = {}) {
  purpose = asList(purpose);
  const cpu = modelOf(parts.cpu.part);
  const gpu = modelOf(parts.gpu?.part) || { id: 'none', name: '내장그래픽', vram: 0, score: 0, watt: 0, psu: 450 };
  const ramTotal = parts.ram.part.attrs.total && parts.ram.part.attrs.count > 1 ? parts.ram.part.attrs.total : parts.ram.part.attrs.per * parts.ram.qty;
  const items = ORDER.map((k) => {
    const meta = SLOTS.find((s) => s.key === k);
    const x = parts[k];
    return {
      slot: k, label: meta.label, ball: meta.ball, easy: meta.easy, desc: meta.desc,
      part: x ? x.part : null, qty: x ? x.qty : 0, cost: x ? x.part.price * x.qty : 0,
      why: reasons(k, parts, cpu, gpu, purpose),
    };
  });
  const sum = items.reduce((s, i) => s + i.cost, 0);
  return {
    budget, purpose, purposeLabel: purpose.map((k) => PURPOSES[k].label).join(' + '), total: sum, items,
    ids: Object.fromEntries(ORDER.map((k) => [k, parts[k] ? { id: parts[k].part.id, qty: parts[k].qty } : null])),
    compat: compat(parts, cpu, gpu), perf: performance(cpu, gpu, ramTotal),
    summary: `${cpu.name} + ${gpu.name} + 램 ${ramTotal}GB`,
    ...extra,
  };
}
