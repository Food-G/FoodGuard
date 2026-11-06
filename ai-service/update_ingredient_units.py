# ⚠ 재실행 금지. 수량을 환산하지 않고 단위 이름만 바꾸므로, 다시 돌리면 재고·레시피 수량이 1000배 어긋날 수 있다.
"""기존 식자재 단위를 발주 기준 단위로 일괄 변환 (g→kg, ml→L)"""
import os
import sys
import requests
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
load_dotenv()

BASE = "http://localhost:8080/api"

res = requests.post(f"{BASE}/auth/login", json={"email": os.environ["FOODGUARD_OWNER_EMAIL"],
                                                "password": os.environ["FOODGUARD_OWNER_PASSWORD"]})
TOKEN = res.text.strip()
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# 전체 식자재 조회
all_ings = requests.get(f"{BASE}/ingredients", headers=HEADERS).json()

UNIT_MAP = {"g": "kg", "Kg": "kg", "ml": "L", "mg": "g"}  # mg는 g로
updated = 0

for ing in all_ings:
    old_unit = ing.get("unit", "")
    new_unit = UNIT_MAP.get(old_unit)
    if new_unit is None:
        continue
    r = requests.put(f"{BASE}/ingredients/{ing['id']}",
                     json={"name": ing["name"], "unit": new_unit}, headers=HEADERS)
    if r.status_code == 200:
        print(f"  ✓ {ing['name']}: {old_unit} → {new_unit}")
        updated += 1
    else:
        print(f"  ✗ {ing['name']} 실패: {r.status_code}")

print(f"\n총 {updated}개 식자재 단위 업데이트 완료")
