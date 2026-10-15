# Vercel 함수: 다나와 가격 조회 (k-skill danawa-price-search)
#   GET /api/danawa?cmd=search&q=RTX%205060
#   GET /api/danawa?cmd=offers&pcode=69059753
# 1) 다나와에서 바로 조회 → 성공하면 Vercel CDN에 6시간 캐시
# 2) 다나와가 클라우드 서버를 막으면(403 등) → lib/snapshot.json(로컬에서 모아 둔 가격)으로 대신 응답
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

LIB = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib')
sys.path.insert(0, LIB)
import danawa_ext  # noqa: E402

_snapshot = None


def snapshot():
    global _snapshot
    if _snapshot is None:
        try:
            with open(os.path.join(LIB, 'snapshot.json'), encoding='utf-8') as f:
                _snapshot = json.load(f)
        except Exception:
            _snapshot = {'entries': {}}
    return _snapshot


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        cmd = (q.get('cmd') or [''])[0]
        data, live, err = None, False, None
        if cmd == 'search' and q.get('q'):
            key = 's:' + q['q'][0][:100]
            try:
                data = danawa_ext.run_search(q['q'][0][:100])
                live = bool(data and data.get('items'))
            except Exception as e:
                err = str(e)
        elif cmd == 'offers' and q.get('pcode') and q['pcode'][0].isdigit():
            key = 'o:' + q['pcode'][0]
            try:
                data = danawa_ext.run_offers(q['pcode'][0])
                live = data is not None and bool(data.get('offers'))
            except Exception as e:
                err = str(e)
        else:
            return self.reply(400, {'error': 'cmd=search&q=… 또는 cmd=offers&pcode=… 형식이어야 해요'}, 'no-store')

        if live:
            return self.reply(200, data, 'public, s-maxage=21600, stale-while-revalidate=86400')
        snap = snapshot()
        hit = snap.get('entries', {}).get(key)
        if hit:
            out = dict(hit)
            out['snapshot'] = snap.get('created')
            # 저장본은 30분만 캐시해서 다나와가 다시 열리면 곧 실시간 가격으로 돌아간다
            return self.reply(200, out, 'public, s-maxage=1800')
        return self.reply(502, {'error': err or '다나와에서 가격을 가져오지 못했어요'}, 'no-store')

    def reply(self, code, data, cache):
        body = json.dumps(data or {}, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', cache)
        self.end_headers()
        self.wfile.write(body)
