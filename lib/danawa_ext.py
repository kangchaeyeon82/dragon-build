"""k-skill danawa-price-search 확장 래퍼.

k-skill 스크립트(lib/kskill/danawa_search.py)의 fetch/파서를 그대로 재사용하고,
검색 결과의 용량별 가격 줄(variant), 판매처 수, 카테고리 코드를 추가로 뽑는다.

- 로컬 서버: python lib/danawa_ext.py search "<query>" | offers <pcode>
- Vercel:    api/danawa.py 가 run_search / run_offers 를 import 해서 사용
"""
import importlib.util
import json
import os
import re
import sys
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
_sk = None


def skill():
    global _sk
    if _sk is None:
        path = os.path.join(HERE, 'kskill', 'danawa_search.py')
        spec = importlib.util.spec_from_file_location('danawa_search', path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _sk = mod
    return _sk


def cate_of(href):
    if not href:
        return None
    q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
    return (q.get("cate") or [None])[0]


TAG = re.compile(r"<[^>]+>")
FLIGHT = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')


def parse_new_layout(html):
    """다나와 새 검색 화면(Next.js): 페이지 안의 products JSON을 읽는다."""
    flight = "".join(json.loads('"' + c + '"') for c in FLIGHT.findall(html))
    i = flight.find('{"products":[')
    if i < 0:
        return []
    obj, _ = json.JSONDecoder().raw_decode(flight[i:])
    out = []
    for p in obj.get("products") or []:
        pid = str(p.get("productSeq") or "")
        if not pid.isdigit():
            continue
        title = " ".join(TAG.sub("", p.get("productName") or "").split())
        desc = (p.get("summary") or {}).get("desc") or []
        spec = " / ".join(" ".join(TAG.sub("", d).split()) for d in desc[:16])
        base = {
            "group": pid,
            "title": title,
            "maker": p.get("makerName") or None,
            "cate": cate_of(p.get("linkUrl")),
            "spec": spec[:400] or None,
            "image": p.get("imageUrl") or None,
        }
        # 용량·구성별 가격 줄 (형식이 확실하지 않아 흔한 이름들을 차례로 확인)
        bundles = [b for b in (p.get("bundleList") or []) if isinstance(b, dict)]
        rows = []
        for b in bundles:
            vid = str(b.get("productSeq") or b.get("productCode") or b.get("bundleProductSeq") or "")
            price = b.get("minPrice") or b.get("price") or b.get("minPriceNumber")
            if vid.isdigit() and isinstance(price, (int, float)) and price > 0:
                cap = b.get("bundleName") or b.get("name") or b.get("optionName") or b.get("capacity")
                rows.append((vid, int(price), TAG.sub("", cap).strip() if isinstance(cap, str) else None, b.get("shopCount") or 0))
        if not rows and (p.get("minPrice") or 0) > 0:
            rows.append((pid, int(p["minPrice"]), (p.get("totalCapacity") or None), p.get("shopCount") or 0))
        for vid, price, cap, malls in rows:
            out.append({**base, "pcode": vid, "capacity": cap or None, "price": price, "malls": int(malls or 0),
                        "url": f"https://prod.danawa.com/info/?pcode={vid}"})
    return out


def search_variants(sk, query):
    url = "https://search.danawa.com/dsearch.php?query=" + urllib.parse.quote(query)
    html = sk.fetch(url)
    # 다나와는 예전 화면과 새 화면을 번갈아 보여 준다 → 둘 다 읽는다
    if "prod_item" not in html and "__next_f.push" in html:
        return {"query": query, "items": parse_new_layout(html), "layout": "new"}
    soup = sk.soup_for(html)
    out = []
    for li in soup.select("li.prod_item"):
        pid = (li.get("id") or "").replace("productItem", "")
        if not pid.isdigit():
            continue
        name_el = li.select_one(".prod_name a")
        if not name_el:
            continue
        title = sk.clean_text(name_el.get_text(" ", strip=True))
        img = li.select_one(".thumb_image img")
        image = sk.abs_url((img.get("data-original") or img.get("src")) if img else None)
        spec = " / ".join(sk.clean_text(e.get_text(" ", strip=True)) or "" for e in li.select(".spec_list a, .spec_list span")[:16])
        for row in li.select(".prod_pricelist li[id^=productInfoDetail_]"):
            vid = row.get("id").replace("productInfoDetail_", "")
            link = row.select_one(".price_sect a")
            price = sk.parse_int(link.select_one("strong").get_text() if link and link.select_one("strong") else None)
            if not price:
                continue
            more = row.select_one("button.i_more")
            chk = row.select_one(".chk_sect")
            malls = re.search(r"(\d[\d,]*)\s*몰", chk.get_text(" ", strip=True)) if chk else None
            cap_el = row.select_one(".memory_sect .text")
            cap = sk.clean_text(cap_el.get_text(" ", strip=True)) if cap_el else ""
            out.append({
                "pcode": vid,
                "group": pid,
                "title": title,
                "capacity": cap or None,
                "maker": more.get("data-maker-name") if more else None,
                "cate": cate_of(link.get("href")),
                "price": price,
                "malls": int(malls.group(1).replace(",", "")) if malls else 0,
                "spec": spec[:400] or None,
                "image": image,
                "url": f"https://prod.danawa.com/info/?pcode={vid}",
            })
    return {"query": query, "items": out}


def _retry(fn, ok, tries=3):
    # 다나와가 가끔 빈 페이지를 돌려줘서 몇 번 다시 시도한다
    last = None
    for i in range(tries):
        try:
            last = fn()
            if ok(last):
                return last
        except Exception:
            if i == tries - 1:
                raise
        time.sleep(1.0 * (i + 1))
    return last


def run_search(query):
    return _retry(lambda: search_variants(skill(), query), lambda d: bool(d and d.get("items")))


def run_offers(pcode, limit=40):
    return _retry(lambda: skill().offers(str(pcode), limit=limit), lambda d: d is not None and d.get("offers") is not None)


def main():
    cmd = sys.argv[1]
    if cmd == "search":
        res = search_variants(skill(), sys.argv[2])
    elif cmd == "offers":
        res = skill().offers(sys.argv[2], limit=40)
    else:
        raise SystemExit("unknown command")
    sys.stdout.write(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
