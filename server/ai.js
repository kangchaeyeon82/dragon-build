// 신룡 상담: Gemini로 답변, 리뷰·성능 비교처럼 바깥 정보가 필요한 질문은 Firecrawl 검색 결과를 근거로 붙인다.
const MODELS = [...new Set([process.env.GEMINI_MODEL || 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash'])];

const SYSTEM = `너는 "신룡"이다. 컴퓨터 부품을 전혀 모르는 사람의 PC 견적 고민을 들어주는 친절한 조언자다.
규칙:
- 한국어로, 전문용어는 쉬운 비유로 풀어서 짧게(5~8문장) 답한다. 꼭 필요한 경우만 목록을 쓴다.
- 말투는 정중하지만 살짝 웅장하게. 첫 문장에 "소원을 말하라" 같은 대사는 반복하지 말고 바로 답한다.
- 사용자의 현재 조합(JSON)이 주어지면 그 부품 기준으로 판단한다. 가격은 주어진 숫자만 쓰고 지어내지 않는다.
- 웹 검색 자료가 주어지면 그 내용을 근거로 답하고, 근거가 부족하면 모른다고 말한다.
- 구매·결제를 대신 해주겠다고 하지 않는다.`;

const NEEDS_WEB = /리뷰|후기|벤치|성능 차이|비교|평가|발열|소음|불량|이슈|출시|신제품|프레임|fps|호환|드라이버/i;

async function firecrawlSearch(query) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const r = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 4, location: 'South Korea' }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json();
    const web = j?.data?.web || j?.data || [];
    return web.slice(0, 4).map((w) => ({ title: w.title, url: w.url, snippet: (w.description || w.markdown || '').slice(0, 500) }));
  } catch {
    return [];
  }
}

async function gemini(contents) {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY가 .env에 없습니다.');
  let lastErr;
  for (const model of MODELS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents }),
      signal: AbortSignal.timeout(60000),
    });
    const j = await r.json();
    if (r.ok) {
      const parts = j.candidates?.[0]?.content?.parts || [];
      return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
    }
    lastErr = new Error(j.error?.message || 'Gemini 오류');
    // 모델 없음·과부하·일시 오류면 다음 모델로 넘어간다
    if (![404, 429, 500, 503].includes(r.status)) break;
  }
  throw lastErr;
}

// history: [{role:'user'|'model', text}], build: 현재 조합 요약(선택)
export async function ask(history, build) {
  const last = history[history.length - 1]?.text || '';
  let sources = [];
  let context = '';
  if (build) {
    context += `\n\n[사용자의 현재 조합]\n${JSON.stringify(build)}`;
  }
  if (NEEDS_WEB.test(last)) {
    const parts = build?.parts?.map((p) => p.name).slice(0, 2).join(' ') || '';
    sources = await firecrawlSearch(`${last} ${/비교|호환/.test(last) ? parts : ''}`.trim());
    if (sources.length) context += `\n\n[웹 검색 자료]\n` + sources.map((s, i) => `(${i + 1}) ${s.title}\n${s.snippet}`).join('\n\n');
  }
  const contents = history.slice(-10).map((m, i, arr) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: i === arr.length - 1 ? m.text + context : m.text }],
  }));
  const answer = await gemini(contents);
  return { answer, sources: sources.map(({ title, url }) => ({ title, url })) };
}
