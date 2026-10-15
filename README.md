# 드래곤 견적

예산과 용도만 고르면 PC 꿀조합을 찾아 주고, 부품별 최저가~최고가를 보여 주는 사이트.

## 실행

```
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. 처음 켜면 다나와 가격을 모으는 데 30초~1분 걸리고, 이후 6시간 동안은 `data/cache.json` 캐시를 씁니다.

필요한 것: Node 22+, Python 3 + `beautifulsoup4`, `.env`의 `GOOGLE_API_KEY`(Gemini) · `FIRECRAWL_API_KEY`.

## 구성

| 파일 | 역할 |
|---|---|
| `server/danawa_ext.py` | k-skill `danawa-price-search` 스크립트를 불러와 검색 결과의 용량별 가격·판매처 수·카테고리를 추가로 파싱 |
| `server/danawa.js` | 파이썬 헬퍼 실행, 재시도, 동시 실행 제한, 캐시 |
| `server/catalog.js` | 다룰 모델 목록과 성능 점수 (새 CPU·그래픽카드는 여기에 추가) |
| `server/parts.js` | 다나와 결과 → 쉬운 이름·스펙·호환성 속성 |
| `server/engine.js` | 꿀조합 계산, 부품 업/다운, 호환성 체크, 체감 성능 별점 |
| `server/ai.js` | 신룡 상담 (Gemini, 리뷰·비교 질문은 Firecrawl 웹 검색을 근거로 사용) |
| `public/` | 화면 (탭 4개: 소원 빌기 · 드래곤 레이더 · 캡슐 보관함 · 신룡에게 묻기) |
