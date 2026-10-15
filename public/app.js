// 드래곤 견적 프론트엔드
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const won = (n) => (n || 0).toLocaleString('ko-KR') + '원';
const man = (n) => Math.round(n / 10000).toLocaleString('ko-KR') + '만원';

const state = { budget: 200, purposes: ['edit'], build: null, slots: [], radar: { slot: 'cpu', sort: 'asc', q: '', cache: {} }, chat: [] };

/* ---------- 드래곤볼 SVG ---------- */
const STAR_POS = {
  1: [[50, 52]], 2: [[38, 42], [62, 60]], 3: [[50, 34], [35, 60], [65, 60]], 4: [[37, 38], [63, 38], [37, 64], [63, 64]],
  5: [[50, 30], [31, 46], [69, 46], [39, 69], [61, 69]], 6: [[37, 32], [63, 32], [29, 52], [71, 52], [39, 72], [61, 72]],
  7: [[50, 28], [32, 40], [68, 40], [50, 51], [32, 63], [68, 63], [50, 75]],
};
let gid = 0;
function star(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="#e3121c" stroke="#8a0008" stroke-width=".8"/>`;
}
function ballSVG(n) {
  const id = 'bg' + ++gid;
  const stars = n ? STAR_POS[n].map(([x, y]) => star(x, y, n === 1 ? 14 : 8.5)).join('') : '<text x="50" y="62" text-anchor="middle" font-size="34" font-weight="900" fill="#e3121c">+</text>';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs>
    <radialGradient id="${id}" cx="36%" cy="30%" r="75%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".18" stop-color="#ffd76a"/><stop offset=".55" stop-color="#ff9a0e"/><stop offset="1" stop-color="#b84300"/></radialGradient>
    <radialGradient id="${id}s" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#ffefb0" stop-opacity=".55"/></radialGradient></defs>
    <circle cx="50" cy="50" r="47" fill="url(#${id})"/>${stars}
    <circle cx="50" cy="50" r="47" fill="url(#${id}s)"/>
    <ellipse cx="34" cy="26" rx="14" ry="8" fill="#fff" opacity=".75" transform="rotate(-28 34 26)"/></svg>`;
}

/* ---------- 신룡 SVG (직접 그린 오리지널 용) ---------- */
function drawDragon() {
  // 선(line-art)으로만 그린 신룡: 평소엔 은은하게, 소환되면 주황빛으로 그려진다
  const body = "M70 575 C 10 480, 150 420, 245 470 S 430 570, 480 455 S 340 330, 250 305 S 150 205, 255 160 S 410 125, 455 140";
  $('#dragon').innerHTML = `
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path class="line glow" d="${body}" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
    <path class="line" d="${body}" stroke="rgba(255,174,74,.55)" stroke-width="1.2" transform="translate(0 16)"/>
    <path class="dots" d="${body}" stroke="rgba(255,174,74,.8)" stroke-width="5" stroke-dasharray="0.1 18" transform="translate(0 8)"/>
    <path class="line" d="${body}" stroke="rgba(255,255,255,.35)" stroke-width="1" transform="translate(0 -14)"/>
  </g>
  <g class="head" transform="translate(452 138)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path class="line glow" d="M-14 -20 C 14 -44, 62 -38, 92 -16 L 112 -6 C 118 0, 114 12, 102 12 L 70 14 C 58 28, 30 34, 6 28 C -12 22, -22 4, -14 -20 Z" stroke="rgba(255,255,255,.7)" stroke-width="2"/>
    <path class="line" d="M18 -30 C 4 -64, -18 -86, -42 -94 M36 -32 C 34 -66, 22 -90, 6 -104" stroke="rgba(255,174,74,.9)" stroke-width="2"/>
    <path class="line" d="M70 14 C 80 26, 96 30, 108 24 M6 -8 L 40 -20" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>
    <circle cx="52" cy="-14" r="3.5" fill="#ff8a1a"/>
    <path class="line" d="M104 4 C 150 18, 172 66, 160 116 M92 12 C 124 44, 126 92, 104 134" stroke="rgba(255,255,255,.45)" stroke-width="1.2"/>
    <path class="line" d="M-6 -16 L -30 -36 L -12 -6 L -40 -18 L -14 6 L -40 4" stroke="rgba(255,174,74,.7)" stroke-width="1.5"/>
  </g>`;
}

/* ---------- 부품 아이콘 (약어 박스) ---------- */
const ICON = { cpu: 'CPU', board: 'MB', ram: 'RAM', gpu: 'GPU', ssd: 'SSD', psu: 'PSU', case: 'CASE', cooler: 'FAN' };
const iconBox = (slot) => `<span class="part-icon" aria-hidden="true">${ICON[slot] || '▣'}</span>`;

/* ---------- 쉬운 용어 풀이 ---------- */
const GLOSSARY = {
  'VRAM': '그래픽카드 전용 메모리예요. 클수록 고화질 게임 텍스처나 AI 모델을 많이 올릴 수 있어요.',
  '소켓': 'CPU를 꽂는 자리의 모양이에요. CPU와 메인보드의 소켓이 같아야 꽂혀요.',
  'DDR5': '최신 세대 램 규격이에요. 메인보드가 DDR5를 지원해야 써요.',
  'DDR4': '한 세대 전 램 규격이에요. 값이 싸고, DDR4 메인보드에서만 써요.',
  '듀얼채널': '램을 2개 꽂아 데이터 길을 두 배로 넓히는 방식이에요. 같은 용량이면 2개가 더 빨라요.',
  'NVMe': '메인보드에 직접 꽂는 아주 빠른 SSD 방식이에요.',
  '퀵싱크': '인텔 CPU에 들어 있는 영상 인코딩 가속 기능이에요. 편집·내보내기가 빨라져요.',
  'NVENC': '엔비디아 그래픽카드의 영상 인코딩 가속 기능이에요.',
  '3D V-Cache': 'AMD의 대용량 캐시 기술이에요. 게임 프레임을 크게 올려줘요.',
  '80PLUS': '파워의 전기 효율 등급이에요. 스탠다드 < 브론즈 < 실버 < 골드 순으로 좋아요.',
  '코어': 'CPU 안에서 동시에 일하는 일꾼 수예요. 많을수록 편집·렌더링이 빨라요.',
  '내장그래픽': 'CPU 안에 들어 있는 간단한 그래픽 기능이에요. 그래픽카드 없이도 화면이 나와요.',
  'FHD': '1920×1080 해상도. 가장 흔한 모니터예요.',
  'QHD': '2560×1440 해상도. FHD보다 선명하지만 그래픽카드가 더 힘을 써요.',
  'M-ATX': '보통 크기의 메인보드 규격이에요. 대부분의 케이스에 들어가요.',
  '수랭': '물을 순환시켜 식히는 쿨러예요. 조용하고 강력하지만 비싸요.',
  '공랭': '금속 방열판과 팬으로 식히는 쿨러예요. 튼튼하고 저렴해요.',
};
function terms(text) {
  let html = esc(text);
  for (const [k, v] of Object.entries(GLOSSARY)) {
    const i = html.indexOf(esc(k));
    if (i >= 0) html = html.slice(0, i) + `<span class="term" data-tip="${esc(v)}">${esc(k)}</span>` + html.slice(i + esc(k).length);
  }
  return html;
}
let tipEl = null;
document.addEventListener('mouseover', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t) { tipEl?.remove(); tipEl = null; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
  tipEl.textContent = t.dataset.tip;
  const r = t.getBoundingClientRect();
  tipEl.style.left = Math.min(r.left, innerWidth - 300) + 'px';
  tipEl.style.top = (r.bottom + 8 + tipEl.offsetHeight > innerHeight ? r.top - tipEl.offsetHeight - 8 : r.bottom + 8) + 'px';
});

/* ---------- 공통 UI ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modalX').onclick = closeModal;
$('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

async function api(path, opts) {
  const r = await fetch(path, opts && { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || '요청 실패');
  return j;
}

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'radar') loadRadar();
  if (name === 'capsule') renderCapsules();
  if (name === 'ask') syncAttach();
}
$$('.tab').forEach((t) => (t.onclick = () => switchTab(t.dataset.tab)));

/* ---------- 쇼핑몰별 가격 모달 ---------- */
async function showOffers(part, label) {
  openModal(`<p class="kicker"><span class="klabel">${esc(label)}</span> · ${esc(part.maker || '')}</p><h3>${esc(part.name)}</h3>
    <p class="m-sub">${esc((part.spec || []).join(' · '))}</p><div class="loading"><div class="spinner"></div>쇼핑몰 가격을 모으는 중…</div>`);
  try {
    const r = await api('/api/offers?pcode=' + encodeURIComponent(part.id));
    const list = r.offers.filter((o) => o.total);
    const rows = list.map((o, i) => `
      <div class="offer"><span class="o-rank">${i + 1}</span>
        <div class="o-mall"><b>${esc(o.mall || '쇼핑몰')}${o.condition ? `<span class="tag">${esc(o.condition)} 조건</span>` : ''}${o.free ? '<span class="tag free">무료배송</span>' : ''}</b>
          <small>${esc([o.shipping && !o.free ? o.shipping : '', o.card, o.installment].filter(Boolean).join(' · '))}</small></div>
        <div class="o-price">${won(o.total)}<small>배송비 포함</small></div>
        ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">보러가기</a>` : '<span></span>'}</div>`).join('');
    const lo = list[0]?.total, hi = list[list.length - 1]?.total;
    $('#modalBody').innerHTML = `<p class="kicker"><span class="klabel">${esc(label)}</span> · ${esc(part.maker || '')}</p><h3>${esc(part.name)}</h3>
      <p class="m-sub">${esc((part.spec || []).join(' · '))}</p>
      ${list.length ? `<div class="offer-range"><span>최저 <b>${won(lo)}</b></span><span>최고 <b>${won(hi)}</b></span><span>${list.length}곳 판매</span></div>${rows}` : '<p class="empty-state">지금은 판매 중인 쇼핑몰이 없어요.</p>'}
      <p class="fine">‘현금 조건’ 표시는 현금 결제 시에만 그 가격이에요. 가격·배송비는 조회 시점 기준이고 바뀔 수 있어요. 구매는 각 쇼핑몰에서 직접 진행해요.</p>
      <p><a class="ghost" style="display:inline-block;text-decoration:none" href="${esc(r.url || part.url)}" target="_blank" rel="noopener">다나와에서 자세히 보기 ↗</a></p>`;
  } catch (e) {
    $('#modalBody').insertAdjacentHTML('beforeend', `<p class="empty-state">가격을 불러오지 못했어요: ${esc(e.message)}</p>`);
    $('#modalBody .loading')?.remove();
  }
}

/* ---------- ① 소원 빌기 ---------- */
const budgetEl = $('#budget');
const budgetIn = $('#budgetIn');
const fmtNum = (n) => Math.round(n).toLocaleString('ko-KR');
const BUDGET_MAX = 1000; // 만원
// 입력칸 너비를 숫자 길이에 맞춘다
function fitInput() { const v = budgetIn.value; budgetIn.style.width = Math.max(2, v.replace(/,/g, '').length) + (v.split(',').length - 1) * 0.35 + 0.2 + 'ch'; }
function paintRange() {
  budgetEl.style.setProperty('--fill', ((budgetEl.value - budgetEl.min) / (budgetEl.max - budgetEl.min)) * 100 + '%');
}
// v: 만원 단위 (최대 1,000만원)
function setBudget(v, from) {
  v = Math.max(0, Math.round(+v || 0));
  if (v > BUDGET_MAX) { v = BUDGET_MAX; from = undefined; toast('예산은 최대 1,000만원까지 정할 수 있어요.'); }
  state.budget = v;
  if (from !== 'range') budgetEl.value = Math.max(+budgetEl.min, v);
  if (from !== 'input') budgetIn.value = fmtNum(v);
  fitInput();
  paintRange();
}
budgetEl.oninput = () => setBudget(+budgetEl.value, 'range');
budgetIn.oninput = () => {
  const digits = budgetIn.value.replace(/[^\d]/g, '');
  setBudget(digits ? +digits : 0, 'input');
  if (+digits <= BUDGET_MAX) budgetIn.value = digits ? fmtNum(+digits) : '';
  fitInput();
};
budgetIn.onblur = () => { if (state.budget < 30) { setBudget(30); toast('예산은 30만원 이상으로 정해 주세요.'); } };
budgetIn.onfocus = () => budgetIn.select();
$$('#purposes button').forEach((b) => (b.onclick = () => {
  const k = b.dataset.p;
  const on = state.purposes.includes(k);
  if (on && state.purposes.length === 1) return toast('용도는 하나 이상 골라 주세요.');
  state.purposes = on ? state.purposes.filter((x) => x !== k) : [...state.purposes, k];
  b.classList.toggle('on', !on);
}));

const SLOT_LABEL = { cpu: 'CPU', board: '메인보드', ram: '램', gpu: '그래픽카드', ssd: 'SSD', psu: '파워', case: '케이스', cooler: 'CPU 쿨러' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function placeBalls() {
  const wrap = $('#balls');
  wrap.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
    const el = document.createElement('div');
    el.className = 'ball';
    el.style.left = 50 + 33 * Math.cos(a) + '%';
    el.style.top = 52 + 27 * Math.sin(a) + '%';
    el.style.animationDelay = i * 0.3 + 's';
    el.innerHTML = ballSVG(i + 1);
    wrap.appendChild(el);
  }
}

async function summon() {
  if (state.budget < 30) { setBudget(30); return toast('예산은 30만원 이상으로 정해 주세요.'); }
  const btn = $('#summonBtn'), altar = $('#altar'), msg = $('#altarMsg');
  btn.disabled = true;
  placeBalls();
  altar.classList.remove('summoned');
  altar.classList.add('summoning');
  msg.innerHTML = '드래곤볼을 찾는 중이에요<small>다나와에서 부품 가격을 모으고 있어요 (처음엔 30초쯤 걸릴 수 있어요)</small>';
  const balls = $$('#balls .ball');
  let lit = 0, result = null, failed = null, done = false;
  const queue = [];
  const es = new EventSource(`/api/wish?budget=${state.budget * 10000}&purpose=${state.purposes.join(',')}`);
  es.addEventListener('ball', (e) => queue.push(JSON.parse(e.data).slot));
  es.addEventListener('done', (e) => { result = JSON.parse(e.data); done = true; es.close(); });
  es.addEventListener('fail', (e) => { failed = JSON.parse(e.data).message; done = true; es.close(); });
  es.onerror = () => { if (!done) { failed = '서버와 연결이 끊겼어요. 서버가 켜져 있는지 확인해 주세요.'; done = true; } es.close(); };

  // 이벤트를 하나씩 천천히 보여준다 (연출)
  while (!done || queue.length) {
    if (queue.length) {
      const slot = queue.shift();
      if (lit < 7) balls[lit].classList.add('lit');
      lit++;
      msg.innerHTML = `드래곤볼 ${Math.min(lit, 7)} / 7<small>${esc(SLOT_LABEL[slot] || slot)} 시세 확인 완료</small>`;
      await sleep(420);
    } else await sleep(120);
  }
  if (failed) {
    altar.classList.remove('summoning');
    msg.innerHTML = `소환에 실패했어요<small>${esc(failed)}</small>`;
    btn.disabled = false;
    return;
  }
  balls.forEach((b) => b.classList.add('lit'));
  msg.innerHTML = '7개를 모두 모았어요!<small>신룡이 꿀조합을 고르고 있어요</small>';
  await sleep(500);
  altar.classList.remove('summoning');
  altar.classList.add('summoned');
  altar.insertAdjacentHTML('beforeend', '<div class="flash"></div>');
  setTimeout(() => $('.flash', altar)?.remove(), 1000);
  await sleep(2600);
  state.build = result;
  renderResult(true);
  btn.disabled = false;
}
$('#summonBtn').onclick = summon;
$('#againBtn').onclick = () => {
  $('#result').hidden = true;
  $('#wishForm').hidden = false;
  $('#altar').classList.remove('summoned');
  placeBalls();
  $('#altarMsg').innerHTML = '드래곤볼 7개가 잠들어 있어요<small>예산과 용도를 고르고 소원을 빌어 보세요</small>';
};

function starsHTML(n) { return `<span class="stars-row">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`; }

function renderResult(fresh = false) {
  const b = state.build;
  if (!b) return;
  $('#wishForm').hidden = true;
  $('#result').hidden = false;
  $('#resEyebrow').textContent = `YOUR BUILD · ${b.purposeLabel} · 예산 ${man(b.budget)}`;
  $('#resTitle').textContent = b.overBudget ? '예산이 조금 모자라요 · 가장 알뜰한 조합' : fresh ? '꿀조합을 찾았어요' : '나의 꿀조합';
  $('#buildList').innerHTML = b.items.map((it) => {
    const p = it.part;
    return `<li class="part-row ${p ? '' : 'empty'}" data-slot="${it.slot}">
      ${iconBox(it.slot)}
      <div class="part-body">
        <div class="part-meta"><b>${esc(it.label)}</b>${p?.maker ? `<span>${esc(p.maker)}</span>` : ''}${it.why ? `<span class="info" data-tip="${esc(it.why)}" tabindex="0" aria-label="이 부품을 고른 이유">?</span>` : ''}</div>
        <h3>${p ? esc(p.name) : '내장그래픽 사용 (그래픽카드 없음)'}</h3>
        <p>${p ? esc(p.spec.join(' · ')) : 'CPU 안의 그래픽 기능으로 화면을 출력해요'}</p>
      </div>
      <div class="r-price"><b>${won(it.cost)}</b><small>${it.qty > 1 ? `${won(p.price)} × ${it.qty}개` : p ? '다나와 최저가' : '추가 비용 없음'}</small></div>
      <div class="updown"><button class="up" data-dir="up">▲ 더 좋게</button><button data-dir="down">▼ 더 싸게</button></div>
    </li>`;
  }).join('');
  $$('#buildList .part-row').forEach((row) => {
    const it = b.items.find((x) => x.slot === row.dataset.slot);
    if (it.part) $('.part-body', row).onclick = (e) => { if (!e.target.closest('.info')) showOffers(it.part, it.label); };
    $$('.updown button', row).forEach((btn) => (btn.onclick = () => adjustSlot(it.slot, btn.dataset.dir, row)));
  });
  $('#resTotal').textContent = won(b.total);
  const ratio = b.total / b.budget;
  const fill = $('#budgetFill');
  fill.style.width = Math.min(100, ratio * 100) + '%';
  fill.classList.toggle('over', ratio > 1);
  $('#budgetNote').textContent = ratio > 1 ? `예산보다 ${won(b.total - b.budget)} 넘어요` : `예산 ${man(b.budget)} 중 ${won(b.budget - b.total)} 남았어요`;
  $('#perfList').innerHTML = b.perf.map((p) => `<li><span>${terms(p.label)}</span>${starsHTML(p.stars)}<small>${esc(p.note)}</small></li>`).join('');
  const bad = b.compat.filter((c) => !c.ok).length;
  $('#compatAll').textContent = bad ? `${bad}개 확인 필요` : '모두 통과';
  $('#compatAll').classList.toggle('bad', !!bad);
  $('#compatList').innerHTML = b.compat.map((c) => `<li><span class="${c.ok ? 'yes' : 'no'}">${c.ok ? '✔' : '✖'}</span><span>${esc(c.label)}</span><small>${esc(c.detail)}</small></li>`).join('');
}

async function adjustSlot(slot, dir, row) {
  row.style.opacity = .5;
  try {
    const b = state.build;
    const nb = await api('/api/adjust', { ids: b.ids, slot, dir, budget: b.budget, purpose: b.purpose });
    if (nb.notice) toast(nb.notice);
    state.build = { ...nb, overBudget: false };
    renderResult();
    const diff = nb.total - b.total;
    if (diff) toast(`${SLOT_LABEL[slot]} 변경 · 총액 ${diff > 0 ? '+' : ''}${won(diff)}`);
  } catch (e) { toast(e.message); }
  row.style.opacity = 1;
}

function buildText(b) {
  return [`드래곤 견적 — ${b.purposeLabel} / 예산 ${man(b.budget)}`, ...b.items.map((it) => `· ${it.label}: ${it.part ? it.part.name + (it.qty > 1 ? ` ×${it.qty}` : '') : '내장그래픽'} — ${won(it.cost)}`),
    `합계: ${won(b.total)}`, '(다나와 최저가 기준, 조회 시점 가격)'].join('\n');
}
$('#copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(buildText(state.build)); toast('견적을 복사했어요. 카톡·메모에 붙여 넣으세요!'); } catch { toast('복사하지 못했어요.'); }
};
$('#saveBtn').onclick = () => {
  const caps = loadCaps();
  const b = state.build;
  caps.unshift({ id: Date.now(), name: `${b.purposeLabel} · ${man(b.total)} 조합`, savedAt: new Date().toISOString(), build: b });
  saveCaps(caps);
  toast('캡슐에 저장했어요! 💊');
};
$('#askBtn').onclick = () => {
  switchTab('ask');
  sendChat('이 조합 어때? 초보자 입장에서 장점과 아쉬운 점을 알려줘.');
};

/* ---------- ② 드래곤 레이더 ---------- */
function renderCats() {
  $('#catTabs').innerHTML = state.slots.map((s) => `<button class="${s.key === state.radar.slot ? 'active' : ''}" data-k="${s.key}">${esc(s.label)}</button>`).join('');
  $$('#catTabs button').forEach((c) => (c.onclick = () => {
    state.radar.slot = c.dataset.k; state.radar.q = ''; $('#radarQ').value = '';
    renderCats(); loadRadar();
  }));
}

async function loadRadar() {
  const r = state.radar;
  const meta = state.slots.find((s) => s.key === r.slot);
  if (!meta) return;
  $('#radarIntro').innerHTML = `<b>${esc(meta.label)}</b> = ${esc(meta.easy)}. ${terms(meta.desc)}`;
  const key = r.slot + '|' + r.q;
  const list = $('#radarCards');
  if (!r.cache[key]) {
    list.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
    $('#radarRange').textContent = '불러오는 중…';
    try {
      r.cache[key] = (await api(`/api/parts?slot=${r.slot}${r.q ? '&q=' + encodeURIComponent(r.q) : ''}`)).items;
    } catch (e) {
      list.innerHTML = `<p class="empty-state">불러오지 못했어요: ${esc(e.message)}</p>`;
      return;
    }
    if (key !== r.slot + '|' + r.q) return; // 그 사이 다른 카테고리 선택
  }
  renderRadar(r.cache[key], meta);
}

function renderRadar(items, meta) {
  const r = state.radar;
  const list = [...items].sort((a, b) => (r.sort === 'asc' ? a.price - b.price : b.price - a.price));
  const prices = items.map((i) => i.price);
  $('#radarRange').innerHTML = items.length
    ? `${items.length}개 · ${won(Math.min(...prices))} ~ ${won(Math.max(...prices))}${r.q ? ' · <a href="#" id="clearQ">검색 지우기</a>' : ''}`
    : (r.q ? '<a href="#" id="clearQ">검색 지우기</a>' : '');
  $('#clearQ')?.addEventListener('click', (e) => { e.preventDefault(); r.q = ''; $('#radarQ').value = ''; loadRadar(); });
  $('#radarCards').innerHTML = list.length ? list.map((p, i) => `
    <article class="part-row" data-i="${i}" tabindex="0">
      ${iconBox(meta.key)}
      <div class="part-body">
        <div class="part-meta"><b>${esc(meta.label)}</b>${p.maker ? `<span>${esc(p.maker)}</span>` : ''}${p.capacity && !p.name.includes(p.capacity) ? `<span>${esc(p.capacity)}</span>` : ''}</div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.spec.slice(0, 4).join(' · '))}</p>
      </div>
      <div class="part-right">
        <strong>${won(p.price)}</strong>
        <span class="link">가격 비교 ↗</span>
      </div>
    </article>`).join('') : '<p class="empty-state">검색 결과가 없어요. 다른 이름으로 찾아보세요.</p>';
  $$('#radarCards .part-row').forEach((c) => {
    const open = () => showOffers(list[+c.dataset.i], meta.label);
    c.onclick = open;
    c.onkeydown = (e) => { if (e.key === 'Enter') open(); };
  });
}
$('#radarSearch').onsubmit = (e) => { e.preventDefault(); state.radar.q = $('#radarQ').value.trim(); loadRadar(); };
$('#sortSel').onchange = (e) => { state.radar.sort = e.target.value; loadRadar(); };

/* ---------- ③ 캡슐 보관함 ---------- */
const CAP_KEY = 'dragon.capsules';
function loadCaps() { try { return JSON.parse(localStorage.getItem(CAP_KEY)) || []; } catch { return []; } }
function saveCaps(c) { try { localStorage.setItem(CAP_KEY, JSON.stringify(c)); } catch { toast('브라우저 저장 공간을 쓸 수 없어요.'); } updateCapBadge(); }
function updateCapBadge() { const n = loadCaps().length; const b = $('#capsuleCount'); b.hidden = !n; b.textContent = n; }
const selected = new Set();

function renderCapsules() {
  const caps = loadCaps();
  $('#compareView').hidden = true;
  [...selected].forEach((id) => { if (!caps.some((c) => c.id === id)) selected.delete(id); });
  $('#compareBtn').disabled = selected.size !== 2;
  $('#capsules').innerHTML = caps.length ? caps.map((c, i) => `
    <div class="capsule ${selected.has(c.id) ? 'sel' : ''}" data-id="${c.id}">
      <label><input type="checkbox" ${selected.has(c.id) ? 'checked' : ''}/> 비교</label>
      <div class="cap-top"><span class="cap-ico">${i + 1}</span><div><h3 contenteditable="true" spellcheck="false" title="눌러서 이름 바꾸기">${esc(c.name)}</h3>
      <div class="meta">${new Date(c.savedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })} · ${esc(c.build.purposeLabel)}</div></div></div>
      <div class="cap-total">${won(c.build.total)}</div>
      <div class="sum">${esc(c.build.summary)}</div>
      <div class="cap-actions"><button class="gold" data-a="open">불러오기</button><button class="ghost" data-a="copy">복사</button><button class="ghost" data-a="del">삭제</button></div>
    </div>`).join('') : `<div class="empty-state" style="grid-column:1/-1"><p>아직 보관한 캡슐이 없어요.<br/>‘소원 빌기’에서 꿀조합을 찾은 뒤 <b>캡슐에 저장</b>을 눌러 보세요.</p></div>`;
  $$('#capsules .capsule').forEach((el) => {
    const id = +el.dataset.id;
    const cap = caps.find((c) => c.id === id);
    $('input', el).onchange = (e) => {
      if (e.target.checked) { if (selected.size >= 2) { e.target.checked = false; return toast('비교는 2개까지만 고를 수 있어요.'); } selected.add(id); } else selected.delete(id);
      el.classList.toggle('sel', e.target.checked);
      $('#compareBtn').disabled = selected.size !== 2;
    };
    $('h3', el).onblur = (e) => { cap.name = e.target.textContent.trim() || cap.name; saveCaps(caps); };
    $('h3', el).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
    $$('[data-a]', el).forEach((b) => (b.onclick = async () => {
      if (b.dataset.a === 'open') { state.build = cap.build; switchTab('wish'); renderResult(); }
      if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(buildText(cap.build)); toast('복사했어요!'); } catch { toast('복사하지 못했어요.'); } }
      if (b.dataset.a === 'del') { saveCaps(caps.filter((c) => c.id !== id)); selected.delete(id); renderCapsules(); toast('캡슐을 지웠어요.'); }
    }));
  });
}
$('#compareBtn').onclick = () => {
  const caps = loadCaps().filter((c) => selected.has(c.id));
  if (caps.length !== 2) return;
  const [A, B] = caps;
  const row = (it, other) => {
    if (!it) return '<td>—</td>';
    const diff = (it.part?.id || 'none') !== (other?.part?.id || 'none');
    return `<td class="${diff ? 'diff' : ''}">${esc(it.part ? it.part.name : '내장그래픽')}${it.qty > 1 ? ` ×${it.qty}` : ''}<small>${won(it.cost)}</small></td>`;
  };
  const slots = A.build.items.map((x) => x.slot);
  const perfRow = (k) => {
    const a = A.build.perf.find((p) => p.key === k), b = B.build.perf.find((p) => p.key === k);
    return `<tr><td>${esc(a.label)}</td><td>${starsHTML(a.stars)}</td><td>${starsHTML(b.stars)}</td></tr>`;
  };
  const v = $('#compareView');
  v.hidden = false;
  v.innerHTML = `<div class="cmp-head"><h3>캡슐 비교</h3><button class="ghost" id="cmpClose">닫기</button></div>
    <table><thead><tr><th>부품</th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>
    ${slots.map((s) => `<tr><td>${esc(SLOT_LABEL[s])}</td>${row(A.build.items.find((x) => x.slot === s), B.build.items.find((x) => x.slot === s))}${row(B.build.items.find((x) => x.slot === s), A.build.items.find((x) => x.slot === s))}</tr>`).join('')}
    <tr><th>총액</th><th>${won(A.build.total)}</th><th>${won(B.build.total)}</th></tr>
    ${A.build.perf.map((p) => perfRow(p.key)).join('')}</tbody></table>
    <p class="fine">주황색 글씨는 두 견적에서 서로 다른 부품이에요.</p>`;
  $('#cmpClose').onclick = () => (v.hidden = true);
};

/* ---------- ④ 신룡에게 묻기 ---------- */
function syncAttach() {
  const has = !!state.build;
  $('#attachBuild').disabled = !has;
  if (!has) $('#attachBuild').checked = false;
  $('#attachLabel').textContent = has ? `현재 조합 함께 보내기 (${man(state.build.total)})` : '보낼 조합 없음';
}
function compactBuild(b) {
  return { budget: b.budget, purpose: b.purposeLabel, total: b.total, parts: b.items.map((it) => ({ slot: it.label, name: it.part ? it.part.name : '내장그래픽', qty: it.qty, price: it.cost, spec: it.part?.spec })) };
}
function addMsg(role, html) {
  const log = $('#chatLog');
  log.insertAdjacentHTML('beforeend', `<div class="msg ${role}">${role === 'bot' ? '<div class="avatar">龍</div>' : ''}<div class="bubble">${html}</div></div>`);
  log.scrollTop = log.scrollHeight;
  return log.lastElementChild;
}
async function sendChat(text) {
  text = text.trim();
  if (!text) return;
  syncAttach();
  addMsg('me', esc(text));
  state.chat.push({ role: 'user', text });
  const wait = addMsg('bot', '<span class="typing"><span></span><span></span><span></span></span>');
  try {
    const r = await api('/api/ask', { history: state.chat, build: $('#attachBuild').checked && state.build ? compactBuild(state.build) : null });
    state.chat.push({ role: 'model', text: r.answer });
    $('.bubble', wait).innerHTML = esc(r.answer).replace(/\*\*(.+?)\*\*/g, '<em>$1</em>') +
      (r.sources?.length ? `<div class="sources">참고한 웹 자료${r.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">↗ ${esc(s.title || s.url)}</a>`).join('')}</div>` : '');
  } catch (e) {
    state.chat.pop();
    $('.bubble', wait).textContent = '신룡이 잠시 응답하지 못했어요: ' + e.message;
  }
  $('#chatLog').scrollTop = $('#chatLog').scrollHeight;
}
$('#chatForm').onsubmit = (e) => { e.preventDefault(); const q = $('#chatQ'); sendChat(q.value); q.value = ''; };
$$('#chatSuggest button').forEach((b) => (b.onclick = () => sendChat(b.textContent)));

/* ---------- 시작 ---------- */
(async function init() {
  setBudget(200);
  updateCapBadge();
  try { state.slots = (await api('/api/meta')).slots; } catch { toast('서버에 연결하지 못했어요.'); }
  drawDragon();
  placeBalls();
  renderCats();
})();
