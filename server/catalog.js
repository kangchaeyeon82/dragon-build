// 부품 카탈로그: 어떤 모델을 다나와에서 찾을지 + 꿀조합 계산용 성능 점수.
// 가격은 전부 실시간 다나와 조회로 채운다. 점수는 상대 비교용 대략치(최상위=100).

// 다나와 카테고리 코드
export const CATE = {
  cpu: ['113973', '113990', '112747'],
  board: ['112751'],
  ram: ['112752'],
  gpu: ['112753'],
  ssd: ['112760'],
  psu: ['112777'],
  case: ['112775'],
  cooler: ['11236855'],
};

export const SLOTS = [
  { key: 'cpu', label: 'CPU', ball: 1, easy: '컴퓨터의 두뇌', desc: '모든 계산을 맡는 핵심 부품이에요. 영상 편집·인코딩처럼 일이 많은 작업은 코어(일꾼) 수가 많을수록 빨라요.' },
  { key: 'board', label: '메인보드', ball: 2, easy: '부품들을 잇는 몸통', desc: '모든 부품을 꽂아서 연결해 주는 판이에요. CPU와 소켓(꽂는 자리) 모양이 맞아야 해요.' },
  { key: 'ram', label: '램(메모리)', ball: 3, easy: '작업 책상의 넓이', desc: '지금 하는 작업을 잠깐 올려두는 공간이에요. 넓을수록 프로그램을 여러 개 켜도 버벅이지 않아요.' },
  { key: 'gpu', label: '그래픽카드', ball: 4, easy: '화면·영상 담당 근육', desc: '게임 화면과 영상 효과, AI 계산을 맡아요. 게임 성능은 거의 이 부품이 결정해요.' },
  { key: 'ssd', label: 'SSD(저장장치)', ball: 5, easy: '파일을 보관하는 창고', desc: '윈도우·프로그램·영상 파일이 저장되는 곳이에요. 용량(TB)이 클수록 많이 담아요.' },
  { key: 'psu', label: '파워', ball: 6, easy: '전기를 공급하는 심장', desc: '콘센트 전기를 부품에 맞게 바꿔 주는 장치예요. 용량(W)이 모자라면 컴퓨터가 꺼질 수 있어요.' },
  { key: 'case', label: '케이스', ball: 7, easy: '부품을 담는 집', desc: '부품을 넣는 본체 껍데기예요. 그래픽카드 길이와 쿨러 높이가 들어가는지 확인해요.' },
  { key: 'cooler', label: 'CPU 쿨러', ball: 0, easy: '두뇌의 열을 식히는 선풍기', desc: 'CPU 열을 식혀요. 성능 좋은 CPU일수록 더 큰 쿨러가 필요해요.' },
];

export const PURPOSES = {
  game: { label: '게이밍', desc: '배그·롤·스팀 게임을 부드럽게' },
  edit: { label: '영상편집·작업', desc: '프리미어·다빈치·포토샵' },
  ai: { label: 'AI·개발', desc: '로컬 AI·코딩·딥러닝' },
  office: { label: '사무·인강', desc: '문서·웹서핑·온라인 강의' },
};

const has = (...inc) => (t) => inc.every((s) => t.includes(s));
const not = (...exc) => (t) => !exc.some((s) => t.includes(s));
const all = (...fns) => (t) => fns.every((f) => f(t));

// CPU — t는 공백 제거 + 대문자 변환된 제목
export const CPUS = [
  { id: 'r5-5600', name: 'AMD 라이젠5 5600', brand: 'AMD', q: '라이젠5 5600', match: all(has('5600'), not('5600X', '5600G', '5600T', '5600XT', '7600', '8600', '9600')), socket: 'AM4', mem: 'DDR4', cores: '6코어 12스레드', game: 46, multi: 38, igpu: false, tdp: 65 },
  { id: 'r7-5700x3d', name: 'AMD 라이젠7 5700X3D', brand: 'AMD', q: '라이젠7 5700X3D', match: has('5700X3D'), socket: 'AM4', mem: 'DDR4', cores: '8코어 16스레드', game: 66, multi: 50, igpu: false, tdp: 105 },
  { id: 'i3-14100', name: '인텔 코어 i3-14100', brand: '인텔', q: '코어 i3 14100', match: all(has('14100'), not('14100F')), socket: 'LGA1700', mem: 'DDR4', cores: '4코어 8스레드', game: 42, multi: 28, igpu: true, tdp: 60 },
  { id: 'i5-14400f', name: '인텔 코어 i5-14400F', brand: '인텔', q: '코어 i5 14400F', match: has('14400F'), socket: 'LGA1700', mem: 'DDR4', cores: '10코어 16스레드', game: 58, multi: 48, igpu: false, tdp: 65 },
  { id: 'i5-14400', name: '인텔 코어 i5-14400', brand: '인텔', q: '코어 i5 14400', match: all(has('14400'), not('14400F')), socket: 'LGA1700', mem: 'DDR4', cores: '10코어 16스레드', game: 58, multi: 48, igpu: true, tdp: 65 },
  { id: 'i5-14600k', name: '인텔 코어 i5-14600K', brand: '인텔', q: '코어 i5 14600K', match: all(has('14600K'), not('14600KF')), socket: 'LGA1700', mem: 'DDR4', cores: '14코어 20스레드', game: 70, multi: 66, igpu: true, tdp: 125 },
  { id: 'i7-14700k', name: '인텔 코어 i7-14700K', brand: '인텔', q: '코어 i7 14700K', match: all(has('14700K'), not('14700KF')), socket: 'LGA1700', mem: 'DDR4', cores: '20코어 28스레드', game: 78, multi: 86, igpu: true, tdp: 160 },
  { id: 'u5-225', name: '인텔 코어 울트라5 225', brand: '인텔', q: '코어 울트라5 225', match: all(has('울트라5', '시리즈2225'), not('225F')), socket: 'LGA1851', mem: 'DDR5', cores: '10코어 10스레드', game: 58, multi: 55, igpu: true, tdp: 65 },
  { id: 'u5-245k', name: '인텔 코어 울트라5 245K', brand: '인텔', q: '울트라5 245K', match: all(has('울트라5', '245K'), not('245KF')), socket: 'LGA1851', mem: 'DDR5', cores: '14코어 14스레드', game: 66, multi: 70, igpu: true, tdp: 125 },
  { id: 'u7-265k', name: '인텔 코어 울트라7 265K', brand: '인텔', q: '울트라7 265K', match: all(has('울트라7', '265K'), not('265KF')), socket: 'LGA1851', mem: 'DDR5', cores: '20코어 20스레드', game: 74, multi: 88, igpu: true, tdp: 160 },
  { id: 'u9-285k', name: '인텔 코어 울트라9 285K', brand: '인텔', q: '울트라9 285K', match: has('울트라9', '285K'), socket: 'LGA1851', mem: 'DDR5', cores: '24코어 24스레드', game: 78, multi: 100, igpu: true, tdp: 180 },
  { id: 'r5-7500f', name: 'AMD 라이젠5 7500F', brand: 'AMD', q: '라이젠5 7500F', match: has('7500F'), socket: 'AM5', mem: 'DDR5', cores: '6코어 12스레드', game: 62, multi: 50, igpu: false, tdp: 65 },
  { id: 'r5-9600x', name: 'AMD 라이젠5 9600X', brand: 'AMD', q: '라이젠5 9600X', match: all(has('9600X'), not('X3D')), socket: 'AM5', mem: 'DDR5', cores: '6코어 12스레드', game: 70, multi: 56, igpu: true, tdp: 65 },
  { id: 'r7-9700x', name: 'AMD 라이젠7 9700X', brand: 'AMD', q: '라이젠7 9700X', match: all(has('9700X'), not('X3D')), socket: 'AM5', mem: 'DDR5', cores: '8코어 16스레드', game: 74, multi: 70, igpu: true, tdp: 65 },
  { id: 'r7-7800x3d', name: 'AMD 라이젠7 7800X3D', brand: 'AMD', q: '라이젠7 7800X3D', match: has('7800X3D'), socket: 'AM5', mem: 'DDR5', cores: '8코어 16스레드', game: 88, multi: 62, igpu: true, tdp: 120 },
  { id: 'r7-9800x3d', name: 'AMD 라이젠7 9800X3D', brand: 'AMD', q: '라이젠7 9800X3D', match: has('9800X3D'), socket: 'AM5', mem: 'DDR5', cores: '8코어 16스레드', game: 100, multi: 76, igpu: true, tdp: 120 },
  { id: 'r9-9900x', name: 'AMD 라이젠9 9900X', brand: 'AMD', q: '라이젠9 9900X', match: all(has('9900X'), not('X3D')), socket: 'AM5', mem: 'DDR5', cores: '12코어 24스레드', game: 78, multi: 90, igpu: true, tdp: 120 },
  { id: 'r9-9950x', name: 'AMD 라이젠9 9950X', brand: 'AMD', q: '라이젠9 9950X', match: all(has('9950X'), not('X3D')), socket: 'AM5', mem: 'DDR5', cores: '16코어 32스레드', game: 82, multi: 100, igpu: true, tdp: 170 },
];

export const GPUS = [
  { id: 'rtx5050', name: 'RTX 5050 8GB', brand: 'NVIDIA', q: 'RTX 5050', match: has('RTX5050'), vram: 8, score: 36, watt: 130, psu: 550 },
  { id: 'rtx5060', name: 'RTX 5060 8GB', brand: 'NVIDIA', q: 'RTX 5060', match: all(has('RTX5060'), not('5060TI')), vram: 8, score: 46, watt: 145, psu: 550 },
  { id: 'rx9060xt', name: 'RX 9060 XT 16GB', brand: 'AMD', q: 'RX 9060 XT 16GB', match: has('9060XT', '16GB'), vram: 16, score: 53, watt: 160, psu: 600 },
  { id: 'rtx5060ti', name: 'RTX 5060 Ti 16GB', brand: 'NVIDIA', q: 'RTX 5060 Ti 16GB', match: has('RTX5060TI', '16GB'), vram: 16, score: 56, watt: 180, psu: 650 },
  { id: 'rtx5070', name: 'RTX 5070 12GB', brand: 'NVIDIA', q: 'RTX 5070', match: all(has('RTX5070'), not('5070TI')), vram: 12, score: 70, watt: 250, psu: 650 },
  { id: 'rx9070xt', name: 'RX 9070 XT 16GB', brand: 'AMD', q: 'RX 9070 XT', match: has('9070XT'), vram: 16, score: 82, watt: 304, psu: 750 },
  { id: 'rtx5070ti', name: 'RTX 5070 Ti 16GB', brand: 'NVIDIA', q: 'RTX 5070 Ti', match: has('RTX5070TI'), vram: 16, score: 86, watt: 300, psu: 750 },
  { id: 'rtx5080', name: 'RTX 5080 16GB', brand: 'NVIDIA', q: 'RTX 5080', match: has('RTX5080'), vram: 16, score: 100, watt: 360, psu: 850 },
  { id: 'rtx5090', name: 'RTX 5090 32GB', brand: 'NVIDIA', q: 'RTX 5090', match: has('RTX5090'), vram: 32, score: 140, watt: 575, psu: 1000 },
];

// 나머지 카테고리는 검색어 묶음만 정하고, 제품 속성은 다나와 스펙에서 뽑는다.
export const QUERIES = {
  board: ['B760M D4', 'B860M', 'B650M', 'B550M', 'A620M'],
  ram: ['DDR4 3200', 'DDR5 5600', 'DDR5 6000'],
  ssd: ['990 EVO Plus', 'KLEVV CRAS C910G', 'WD BLACK SN850X', 'SK하이닉스 P41', 'Crucial P3 Plus', 'Lexar NM790', 'WD Blue SN5000', '990 PRO'],
  psu: ['CWT NOVA-D', '마이크로닉스 Classic II', '맥스엘리트 STARS GEMINI', '쿨러마스터 MWE 골드', '시소닉 FOCUS GX', 'darkFlash 퍼펙트모스트'],
  case: ['앱코 G31', '앱코 U30', 'darkFlash DLX21', 'darkFlash DS900', '3RSYS T500', '리안리 LANCOOL 207', 'NZXT H5 Flow', '마이크로닉스 WIZMAX'],
  cooler: ['DEEPCOOL AK400 G2', 'Thermalright Peerless Assassin 120 SE', 'Thermalright Phantom Spirit 120 SE', '3RSYS RC1900', '쿨러마스터 MasterLiquid 360', 'ARCTIC Liquid Freezer III 360'],
};

// 판매 형태 중 초보자에게 권하지 않는 것
export const BAD_WORDS = ['중고', '리퍼', '해외구매', '병행', '노트북', '렌탈', '대여', 'ECC', 'REG', '서버', '전시', '반품', '벌크'];
