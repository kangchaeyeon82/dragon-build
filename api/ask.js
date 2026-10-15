// Vercel 함수: 신룡 상담 (Gemini + Firecrawl). 키는 Vercel 환경변수에서 읽는다.
import { ask } from '../server/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST로 요청해 주세요' });
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    res.status(200).json(await ask(Array.isArray(b.history) ? b.history : [], b.build || null));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
