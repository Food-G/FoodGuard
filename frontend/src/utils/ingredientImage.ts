// 식자재 사진: 이름으로 자동 일러스트를 고르고, 사용자가 고른 일러스트·올린 사진을 저장 값으로 바꾼다.
// 일러스트는 Microsoft Fluent Emoji (MIT) — Iconify 의 fluent-emoji 세트를 쓴다.
// 저장 값: null = 자동, "icon:<이름>" = 고른 일러스트, "data:image/..." = 올린 사진

// 이름에 들어 있는 낱말 → 일러스트. 위에서부터 먼저 맞는 것을 쓴다 (긴·구체적인 낱말을 위에)
const RULES: [string[], string][] = [
  [['양상추', '상추', '배추', '시금치', '깻잎', '케일', '청경채', '나물', '로메인', '쌈'], 'leafy-green'],
  [['방울토마토', '토마토'], 'tomato'],
  [['마늘'], 'garlic'],
  [['생강'], 'ginger-root'],
  [['감자'], 'potato'],
  [['당근'], 'carrot'],
  [['고추', '청양', '페퍼론치노'], 'hot-pepper'],
  [['파프리카', '피망'], 'bell-pepper'],
  [['오이', '피클'], 'cucumber'],
  [['버섯'], 'mushroom'],
  [['옥수수'], 'ear-of-corn'],
  [['브로콜리'], 'broccoli'],
  [['가지'], 'eggplant'],
  [['아보카도'], 'avocado'],
  [['완두', '콩'], 'beans'],
  [['레몬'], 'lemon'],
  [['사과'], 'red-apple'],
  [['딸기'], 'strawberry'],
  [['바나나'], 'banana'],
  [['파인애플'], 'pineapple'],
  [['베이컨'], 'bacon'],
  [['닭', '치킨'], 'poultry-leg'],
  [['소고기', '쇠고기', '돼지고기', '패티', '고기', '불고기', '갈비', '스테이크', '목살', '삼겹'], 'cut-of-meat'],
  [['새우'], 'shrimp'],
  [['오징어'], 'squid'],
  [['꽃게', '대게', '게살', '크랩'], 'crab'],
  [['굴'], 'oyster'],
  [['생선', '연어', '참치', '고등어', '어묵'], 'fish'],
  [['계란', '달걀', '메추리알', '알'], 'egg'],
  [['치즈'], 'cheese-wedge'],
  [['버터'], 'butter'],
  [['우유', '생크림', '크림'], 'glass-of-milk'],
  [['버거빵', '번', '빵', '식빵', '토르티야', '또띠아'], 'bread'],
  [['떡'], 'rice-ball'],
  [['쌀', '밥'], 'cooked-rice'],
  [['면', '국수', '사리', '당면', '파스타', '라면'], 'steaming-bowl'],
  [['두부'], 'falafel'],
  [['김치'], 'leafy-green'],
  // '파' 는 파프리카·파인애플·파스타에도 들어 있어 그것들을 먼저 거른 뒤에 본다
  [['양파', '대파', '쪽파', '파'], 'onion'],
  [['소금'], 'salt'],
  [['설탕', '꿀', '물엿', '올리고당'], 'honey-pot'],
  [['간장', '고추장', '된장', '소스', '케첩', '마요', '머스타드', '식초', '기름', '오일', '참기름', '양념'], 'jar'],
];
export const DEFAULT_ICON = 'shallow-pan-of-food';

export const autoIcon = (name: string) => {
  const n = (name ?? '').replace(/\s+/g, '');
  for (const [words, icon] of RULES) if (words.some((w) => n.includes(w))) return icon;
  return DEFAULT_ICON;
};

// 화면에 그릴 것: { kind: 'photo', src } 또는 { kind: 'icon', icon, auto }
export const resolveImage = (name: string, imageUrl?: string | null) => {
  if (imageUrl?.startsWith('data:image/')) return { kind: 'photo' as const, src: imageUrl };
  if (imageUrl?.startsWith('icon:')) return { kind: 'icon' as const, icon: imageUrl.slice(5), auto: false };
  return { kind: 'icon' as const, icon: autoIcon(name), auto: true };
};

// 고를 수 있는 일러스트 (편집 창의 모음)
export const GALLERY = [
  'leafy-green', 'tomato', 'onion', 'garlic', 'potato', 'carrot', 'hot-pepper', 'bell-pepper', 'cucumber', 'mushroom',
  'ear-of-corn', 'broccoli', 'eggplant', 'avocado', 'lemon', 'red-apple', 'cut-of-meat', 'meat-on-bone', 'poultry-leg', 'bacon',
  'shrimp', 'fish', 'squid', 'egg', 'cheese-wedge', 'butter', 'glass-of-milk', 'bread', 'cooked-rice', 'steaming-bowl',
  'falafel', 'beans', 'salt', 'honey-pot', 'jar', 'canned-food', 'shallow-pan-of-food',
];

// 올린 사진을 정사각형으로 잘라 360px JPEG 로 줄인다 (목록에서 가볍게 보이도록)
export const shrinkPhoto = (file: File, size = 360): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('사진 파일만 올릴 수 있어요.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('사진을 열지 못했어요.'));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('사진을 줄이지 못했어요.')); return; }
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

// 진열 묶음: 일러스트로 종류를 정한다 (올린 사진이면 이름으로 고른 일러스트 기준)
export const CATEGORIES = [
  { key: 'veg', label: '채소·과일', icon: 'leafy-green' },
  { key: 'meat', label: '고기·해산물', icon: 'cut-of-meat' },
  { key: 'dairy', label: '유제품·계란', icon: 'cheese-wedge' },
  { key: 'grain', label: '빵·곡물·면', icon: 'bread' },
  { key: 'sauce', label: '소스·양념', icon: 'jar' },
  { key: 'etc', label: '기타', icon: 'shallow-pan-of-food' },
] as const;
const CATEGORY_OF_ICON: Record<string, (typeof CATEGORIES)[number]['key']> = {
  'leafy-green': 'veg', tomato: 'veg', onion: 'veg', garlic: 'veg', 'ginger-root': 'veg', potato: 'veg', carrot: 'veg',
  'hot-pepper': 'veg', 'bell-pepper': 'veg', cucumber: 'veg', mushroom: 'veg', 'ear-of-corn': 'veg', broccoli: 'veg',
  eggplant: 'veg', avocado: 'veg', beans: 'veg', lemon: 'veg', 'red-apple': 'veg', strawberry: 'veg', banana: 'veg', pineapple: 'veg',
  'cut-of-meat': 'meat', 'meat-on-bone': 'meat', 'poultry-leg': 'meat', bacon: 'meat', shrimp: 'meat', fish: 'meat',
  squid: 'meat', crab: 'meat', oyster: 'meat',
  egg: 'dairy', 'cheese-wedge': 'dairy', butter: 'dairy', 'glass-of-milk': 'dairy',
  bread: 'grain', 'cooked-rice': 'grain', 'rice-ball': 'grain', 'steaming-bowl': 'grain',
  salt: 'sauce', 'honey-pot': 'sauce', jar: 'sauce', 'canned-food': 'sauce',
};
export const categoryOf = (name: string, imageUrl?: string | null) => {
  const icon = imageUrl?.startsWith('icon:') ? imageUrl.slice(5) : autoIcon(name);
  return CATEGORY_OF_ICON[icon] ?? 'etc';
};
