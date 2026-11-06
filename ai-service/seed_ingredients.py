"""식자재 + 메뉴-식자재 연결 데이터 삽입 스크립트"""
import os
import sys
import requests
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
load_dotenv()

BASE = "http://localhost:8080/api"

# ── 로그인 (ai-service/.env) ───────────────────────────
res = requests.post(f"{BASE}/auth/login", json={"email": os.environ["FOODGUARD_OWNER_EMAIL"],
                                                "password": os.environ["FOODGUARD_OWNER_PASSWORD"]})
TOKEN = res.text.strip()
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
print(f"로그인 성공 (토큰 길이: {len(TOKEN)})\n")

# ── 식자재 등록 ────────────────────────────────────────
INGREDIENTS = [
    ("버거 번",      "개"),
    ("불고기 패티",  "kg"),
    ("통새우 패티",  "kg"),
    ("소고기 패티",  "kg"),
    ("양상추",       "kg"),
    ("토마토",       "kg"),
    ("양파",         "kg"),
    ("피클",         "kg"),
    ("치즈 슬라이스","kg"),
    ("불고기 소스",  "L"),
    ("새우 소스",    "L"),
    ("갈릭 소스",    "L"),
    ("케첩",         "L"),
    ("마요네즈",     "L"),
    ("머스타드",     "L"),
]

ing_id = {}
print("=== 식자재 등록 ===")
for name, unit in INGREDIENTS:
    r = requests.post(f"{BASE}/ingredients", json={"name": name, "unit": unit}, headers=HEADERS)
    if r.status_code == 200:
        id_ = r.json()["id"]
        ing_id[name] = id_
        print(f"  ✓ {name} ({unit})  → id={id_}")
    else:
        print(f"  ✗ {name} 실패: {r.status_code} {r.text[:80]}")

# ── 메뉴-식자재 연결 ────────────────────────────────────
# menuId: {이름: (qty, unit)}
MENU_INGREDIENTS = {
    3: {  # 불고기버거
        "버거 번":     (1,  "개"),
        "불고기 패티": (80, "g"),
        "양상추":      (20, "g"),
        "양파":        (15, "g"),
        "피클":        (10, "g"),
        "불고기 소스": (20, "ml"),
        "마요네즈":    (10, "ml"),
    },
    4: {  # 통새우버거
        "버거 번":    (1,  "개"),
        "통새우 패티":(90, "g"),
        "양상추":     (20, "g"),
        "토마토":     (15, "g"),
        "피클":       (10, "g"),
        "새우 소스":  (20, "ml"),
        "마요네즈":   (10, "ml"),
    },
    5: {  # 더블불고기버거
        "버거 번":     (1,   "개"),
        "불고기 패티": (160, "g"),
        "양상추":      (25,  "g"),
        "양파":        (20,  "g"),
        "피클":        (10,  "g"),
        "치즈 슬라이스":(20, "g"),
        "불고기 소스": (30,  "ml"),
        "마요네즈":    (15,  "ml"),
    },
    7: {  # 갈릭통새우버거
        "버거 번":    (1,  "개"),
        "통새우 패티":(90, "g"),
        "양상추":     (20, "g"),
        "토마토":     (15, "g"),
        "피클":       (10, "g"),
        "갈릭 소스":  (25, "ml"),
        "마요네즈":   (10, "ml"),
    },
    30001: {  # 치즈버거
        "버거 번":      (1,  "개"),
        "소고기 패티":  (85, "g"),
        "치즈 슬라이스":(20, "g"),
        "양상추":       (20, "g"),
        "토마토":       (15, "g"),
        "양파":         (15, "g"),
        "피클":         (10, "g"),
        "케첩":         (15, "ml"),
        "머스타드":     (10, "ml"),
    },
}

MENU_NAMES = {3: "불고기버거", 4: "통새우버거", 5: "더블불고기버거", 7: "갈릭통새우버거", 30001: "치즈버거"}

print("\n=== 메뉴-식자재 연결 ===")
for menu_id, items in MENU_INGREDIENTS.items():
    print(f"\n  [{MENU_NAMES[menu_id]}] (menuId={menu_id})")
    for name, (qty, unit) in items.items():
        if name not in ing_id:
            print(f"    ✗ {name}: 식자재 id 없음 (등록 실패)")
            continue
        payload = {"menuId": menu_id, "ingredientId": ing_id[name], "qtyPerUnit": qty, "unit": unit}
        r = requests.post(f"{BASE}/menu-ingredients", json=payload, headers=HEADERS)
        if r.status_code == 200:
            print(f"    ✓ {name}: {qty}{unit}")
        else:
            print(f"    ✗ {name}: {r.status_code} {r.text[:80]}")

print("\n완료!")
