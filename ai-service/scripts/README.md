# ai-service 일회성 스크립트

서비스 실행에는 필요 없는 개발·점검용 파일입니다. `ai-service` 폴더에서 `python -m scripts.<이름>`으로 실행합니다.

**DB 는 팀 공용(TiDB Cloud)입니다.** 쓰기 표시가 있는 스크립트는 실행 전에 팀과 합의하세요.

| 파일 | 용도 | DB |
|---|---|---|
| `check_db.py` | 특정 계정·매장의 DB 현황을 출력 | 읽기 |
| `verify_dummy.py` | `insert_dummy.py` 결과(매장 60004)를 확인 | 읽기 |
| `generate_dummy_data.py` | 전 매장·메뉴의 합성 판매 데이터 생성 (`--dry-run` 으로 미리보기) | **쓰기** |
| `insert_dummy.py` | 매장 60004 에 판매·발주 더미 삽입 | **쓰기** |
| `test_dummy.py` | 테스트 매장·메뉴·판매를 넣고 학습·예측을 실행 (단위테스트 아님, CI 에서 돌리지 않음) | **쓰기** |
| `ing_check.txt` | 과거 식자재 목록 출력 결과 (기록용) | - |
| `sales_check.txt` | 과거 메뉴별 판매 건수 출력 결과 (기록용) | - |

`check_db.py`, `verify_dummy.py`, `insert_dummy.py` 는 폴더 안에서 경로 없이 실행하면 설정을 찾지 못합니다.

데이터를 준비하는 스크립트(`seed_ingredients.py`, `seed_shelf_life.py`, `backfill_lots.py`)와 `update_ingredient_units.py`(**재실행 금지**)는 `ai-service` 바로 아래에 있습니다.
