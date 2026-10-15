// 다나와 검색 결과 → 사이트에서 쓰는 부품 객체로 정리 (쉬운 이름, 쉬운 스펙, 호환성 속성)
import { CATE, CPUS, GPUS, QUERIES, BAD_WORDS, SLOTS } from './catalog.js';
// 가격 조회 함수는 실행 환경에서 넣어 준다 (브라우저 → /api/danawa)
let search = async () => { throw new Error('가격 조회 함수가 설정되지 않았어요'); };
export function setSearch(fn) { search = fn; }

export const norm = (t) => (t || '').replace(/\s+/g, '').toUpperCase();

const DISTRIBUTORS = ['피씨디렉트', '제이씨현', '이엠텍', '대원씨티에스', '서린', '파인인포', '코잇', 'STCOM', '에즈윈', '아스크텍', '올로코리아', '디앤디컴', '웨이코스', '인텍앤컴퍼니', '마이크로닉스유통', '앱코유통', '브라보텍', '한미마이크로닉스'];

function cleanName(title) {
  let t = title;
  for (const d of DISTRIBUTORS) t = t.replace(new RegExp('\\s*' + d + '\\s*$'), '');
  return t.replace(/\s*\((애로우레이크|랩터레이크 리프레시|그래니트 릿지|라파엘|버미어)\)/, '').replace(/\s+/g, ' ').trim();
}

const tokens = (spec) => (spec || '').split(' / ').map((s) => s.trim()).filter(Boolean);
function after(toks, label) {
  const i = toks.findIndex((t) => t === label || t.startsWith(label));
  return i >= 0 && i + 1 < toks.length ? toks[i + 1] : null;
}
const num = (s) => (s ? parseFloat(String(s).replace(/,/g, '').match(/[\d.]+/)?.[0]) : null);

const GRADE = { 스탠다드: 1, 브론즈: 2, 실버: 3, 골드: 4, 플래티넘: 5, 티타늄: 6 };

function isBad(it) {
  const t = norm(it.title) + norm(it.capacity);
  return BAD_WORDS.some((w) => t.includes(norm(w))) || /PC$|조립PC|표준PC/.test(norm(it.title));
}

// slot별 속성·쉬운 스펙 만들기
function build(slot, it, extra = {}) {
  const toks = tokens(it.spec);
  const T = norm(it.title);
  const p = {
    id: it.pcode, slot, maker: it.maker, title: it.title, name: cleanName(it.title), capacity: it.capacity,
    price: it.price, malls: it.malls || 0, url: it.url, image: it.image, spec: [], attrs: {}, ...extra,
  };
  if (slot === 'cpu') {
    const m = extra.model;
    const clock = after(toks, '최대 클럭');
    p.spec = [m.cores, clock && `최대 ${clock}`, `소켓 ${m.socket}`, m.mem, m.igpu ? '내장그래픽 있음' : '내장그래픽 없음'];
    p.attrs = { socket: m.socket, mem: m.mem, tdp: m.tdp };
  } else if (slot === 'gpu') {
    const m = extra.model;
    const len = num(after(toks, '가로(길이)'));
    const watt = after(toks, '사용전력');
    p.spec = [`VRAM ${m.vram}GB`, watt && `소비전력 ${watt}`, len && `길이 ${len}mm`, `권장 파워 ${m.psu}W`];
    p.attrs = { length: len || 300 };
  } else if (slot === 'board') {
    const sock = (it.spec || '').match(/소켓\s*(\w+)/)?.[1];
    const socket = sock ? (/^\d+$/.test(sock) ? 'LGA' + sock : sock) : null;
    const mem = /DDR4|D4\b/.test(it.title) || toks.includes('DDR4') ? 'DDR4' : 'DDR5';
    const chip = toks.find((t) => /^(인텔|AMD) [A-Z]\d{3}/.test(t));
    const form = toks.find((t) => /ATX|ITX/.test(t))?.replace(/\s*\(.*\)/, '');
    p.spec = [socket && `소켓 ${socket}`, chip, mem, form, /WIFI/i.test(it.title) ? '와이파이 내장' : null];
    p.attrs = { socket, mem, form };
  } else if (slot === 'ram') {
    const type = T.includes('DDR4') ? 'DDR4' : 'DDR5';
    const cap = it.capacity || '';
    const kit = cap.match(/(\d+)GB\s*\(\s*(\d+)G[Bx×]*\s*[x×]\s*(\d+)\)/i);
    const single = cap.match(/(\d+)GB/);
    const per = kit ? +kit[2] : single ? +single[1] : null;
    const count = kit ? +kit[3] : 1;
    const speed = toks.find((t) => /MHz/.test(t))?.replace(/\s*\(.*\)/, '');
    const cl = it.title.match(/CL\d+/)?.[0];
    p.name = `${cleanName(it.title)}${per ? ` ${kit ? cap : per + 'GB'}` : ''}`;
    p.spec = [per && (count > 1 ? `${per}GB × ${count}개` : `${per}GB`), type, speed, cl];
    p.attrs = { type, per, count, total: per ? per * count : null };
  } else if (slot === 'ssd') {
    const c = (it.capacity || '').match(/(\d+(?:\.\d+)?)\s*(TB|GB)/i);
    const gb = c ? (c[2].toUpperCase() === 'TB' ? +c[1] * 1000 : +c[1]) : null;
    const read = after(toks, '순차읽기');
    const iface = toks.find((t) => /PCIe|SATA/.test(t))?.split(',')[0].replace(/\(.*\)/, '');
    p.name = `${cleanName(it.title)}${it.capacity ? ' ' + it.capacity : ''}`;
    p.spec = [it.capacity, iface, read && `읽기 ${read}`];
    p.attrs = { gb };
  } else if (slot === 'psu') {
    const w = num(it.title.match(/(\d{3,4})\s*W/)?.[1]);
    const g = Object.keys(GRADE).find((k) => it.title.includes(k) || (it.spec || '').includes(k));
    const warranty = toks.find((t) => /무상\s*\d+년/.test(t));
    p.spec = [w && `${w}W`, g && `80PLUS ${g}`, /ATX3/.test(it.title) ? '최신 규격(ATX3)' : null, warranty && `${warranty} 보증`];
    p.attrs = { watt: w, grade: GRADE[g] || 1 };
  } else if (slot === 'case') {
    const vga = num(after(toks, 'VGA 길이'));
    const ch = num(after(toks, 'CPU쿨러 높이'));
    const kind = toks.find((t) => /타워|큐브/.test(t));
    p.spec = [kind, vga && `그래픽카드 ${vga}mm까지`, ch && `쿨러 ${ch}mm까지`];
    p.attrs = { vga: vga || 330, coolerH: ch || 160 };
  } else if (slot === 'cooler') {
    const water = (it.spec || '').includes('수랭') || /360|280|240|LIQUID|수랭/i.test(it.title);
    const tdp = num(after(toks, 'TDP')) || (water ? 300 : 180);
    const h = water ? 0 : num(after(toks, '높이')) || 155;
    p.spec = [water ? '수랭(물 냉각)' : '공랭(바람 냉각)', `감당 발열 ${tdp}W`, h ? `높이 ${h}mm` : '라디에이터 360mm'];
    p.attrs = { tdp, height: h, water };
  }
  p.spec = p.spec.filter(Boolean);
  return p;
}

const inCate = (slot, it) => CATE[slot].includes(it.cate);

// CPU는 정품(멀티팩 포함)만
const cpuOk = (it) => !/벌크|병행|해외/.test(it.capacity || '') && !/벌크/.test(it.title);

// ---- 카테고리별 부품 모으기 ----
export async function loadSlot(slot) {
  const out = new Map();
  const add = (p) => { if (p.price && !out.has(p.id)) out.set(p.id, p); };
  if (slot === 'cpu' || slot === 'gpu') {
    const models = slot === 'cpu' ? CPUS : GPUS;
    await Promise.all(models.map(async (m) => {
      const items = await search(m.q).catch(() => []);
      for (const it of items) {
        if (!inCate(slot, it) || isBad(it) || !m.match(norm(it.title))) continue;
        if (slot === 'cpu' && !cpuOk(it)) continue;
        add(build(slot, it, { model: m, modelId: m.id }));
      }
    }));
  } else {
    await Promise.all(QUERIES[slot].map(async (q) => {
      const items = await search(q).catch(() => []);
      for (const it of items) {
        if (!inCate(slot, it) || isBad(it)) continue;
        add(build(slot, it));
      }
    }));
  }
  return [...out.values()].sort((a, b) => a.price - b.price);
}

// 사이트 검색창용: 자유 검색어 → 해당 카테고리 부품
export async function searchSlot(slot, q) {
  const items = await search(q);
  const res = [];
  for (const it of items) {
    if (!inCate(slot, it) || isBad(it)) continue;
    if (slot === 'cpu' || slot === 'gpu') {
      const models = slot === 'cpu' ? CPUS : GPUS;
      const m = models.find((mm) => mm.match(norm(it.title)));
      if (m) { if (slot === 'cpu' && !cpuOk(it)) continue; res.push(build(slot, it, { model: m, modelId: m.id })); continue; }
      // 카탈로그에 없는 모델은 다나와 스펙을 그대로 보여준다
      const p = build('board', it); // 공통 필드만 사용
      p.slot = slot; p.spec = tokens(it.spec).slice(0, 5); p.attrs = {};
      res.push(p);
      continue;
    }
    res.push(build(slot, it));
  }
  return res.sort((a, b) => a.price - b.price);
}

export function slotMeta(key) {
  return SLOTS.find((s) => s.key === key);
}
