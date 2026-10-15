"""k-skill danawa-price-search 확장 래퍼.

k-skill 스크립트의 fetch/파서를 그대로 재사용하고,
검색 결과의 용량별 가격 줄(variant)과 카테고리 코드를 추가로 뽑는다.

usage:
  python danawa_ext.py <skill_script_path> search "<query>"
  python danawa_ext.py <skill_script_path> offers <pcode> [--limit N]
"""
import importlib.util
import json
import re
import sys
import urllib.parse


def load_skill(path):
    spec = importlib.util.spec_from_file_location("danawa_search", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def cate_of(href):
    if not href:
        return None
    q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
    return (q.get("cate") or [None])[0]


def search_variants(sk, query):
    url = "https://search.danawa.com/dsearch.php?query=" + urllib.parse.quote(query)
    soup = sk.soup_for(sk.fetch(url))
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
        rows = li.select(".prod_pricelist li[id^=productInfoDetail_]")
        for row in rows:
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


def main():
    sk = load_skill(sys.argv[1])
    cmd = sys.argv[2]
    if cmd == "search":
        res = search_variants(sk, sys.argv[3])
    elif cmd == "offers":
        limit = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[4] == "--limit" else 40
        res = sk.offers(sys.argv[3], limit=limit)
    else:
        raise SystemExit("unknown command")
    sys.stdout.write(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
