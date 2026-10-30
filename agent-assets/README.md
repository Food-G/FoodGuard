# FoodGuard 자산 팩 (Agent Assets)

> **2026-10-30, jhy 브랜치로 옮기며 덧붙임 — 이 자산 팩은 `junho` 브랜치(서준호) 백엔드 기준으로 쓰였습니다.**
> jhy(= jihwan 인계본 기준) 코드와 다른 점이 있으니, 아래 표가 우선합니다. `04-business-rules.md` §1 발주 산식과 `.claude/agents/`, `fgagent/order_advisor.md`, `fgcli/planner.py`는 jihwan 기준으로 고쳤습니다. 나머지 문서 전면 갱신은 남은 작업입니다.
>
> | 항목 | 이 문서들(junho 기준) | jhy 코드(jihwan 기준) |
> |---|---|---|
> | 발주 추천 산식 | 7일 예측 합계 × 레시피 × (1+tolerance) | 식자재별 책임 기간(리드타임 − 1 + min(주기, 보관기한)) 안의 추천 발주량(안전재고 포함) × 레시피 |
> | 판매 시 재고 차감 | 있음 (`POST /api/sales`가 재고를 줄임) | **없음.** 재고는 발주 완료(DONE) 때 늘고 폐기 기록 때 줄어듦 |
> | 단위 변환 | `util/UnitConverter` (저장 시 조합 검사) | `util/UnitUtils.convertToBaseUnit` (저장 시 검사 없음) |
> | 스키마 정책 | `ddl-auto=none` + `migrations/*.sql` | `ddl-auto=update` |
> | 예측 모델 | 메뉴별 XGBoost | 전체 매장×메뉴 글로벌 XGBoost + 식자재 단위 conformal 안전재고 |
> | 없는 API | — | `/api/sales/{id}/today-summary`, `/weekly-summary`, AI `/api/accuracy`(PREDICTION_LOG) |
> | 있는 테이블(추가) | — | `WASTE_RECORD`, `SALES_DAY_FLAG`, `STORE_EVENT_NOTE`, `INGREDIENT.shelf_life_days·lead_time_days·order_cycle_days` |

캡스톤 FoodGuard 프로젝트에서 **지금까지 개발한 것을 AI 에이전트가 쓸 수 있는 형태로 정리한 자산**입니다.
모든 내용은 **실제 소스 코드를 직접 읽어 검증**했습니다 (2026-09-11 기준).
자산화 과정에서 발견한 결함 8건은 같은 날 코드에 수정 반영했고, `uml/` 문서도 코드에 맞게 정정했습니다 — 상세는 [CHANGELOG.md](CHANGELOG.md).

## 문서

| 파일 | 내용 | 이럴 때 읽으세요 |
|---|---|---|
| [01-domain-model.md](01-domain-model.md) | 테이블 10개의 실제 스키마, 관계, `uml/` 문서와의 차이 | 데이터 구조를 알아야 할 때 |
| [02-api-catalog.md](02-api-catalog.md) | Spring 40여 개 + AI 서비스 5개 엔드포인트, **미구현 엔드포인트 목록** | 에이전트 툴을 고를 때 |
| [03-ml-model-card.md](03-ml-model-card.md) | 수요 예측기 모델 카드 — 피처, 폴백 전략, confidence 산식, 한계 7가지 | 예측을 해석하거나 개선할 때 |
| [04-business-rules.md](04-business-rules.md) | 발주 추천·재고 차감·상태 머신의 **정식 산식**, 안전 규칙 | 에이전트가 계산·검산할 때 |
| [05-data-inventory.md](05-data-inventory.md) | 어떤 데이터가 얼마나 있는지, 품질 이슈 7가지, 만들어야 할 데이터 | 학습·평가를 계획할 때 |
| [06-agent-blueprints.md](06-agent-blueprints.md) | 에이전트 설계 원칙·프롬프트 템플릿 (API 방식 기준, 참고용) | 에이전트를 새로 추가할 때 |

## 실행 자산 — Claude Code 서브에이전트

에이전트는 **Claude Code 서브에이전트**로 구현돼 있습니다 (터미널에서 실행, API 키 불필요).

| 파일 | 용도 |
|---|---|
| `.claude/agents/foodguard-analyst.md` | 점주 관점 운영 분석 — 예측·재고·발주 |
| `.claude/agents/foodguard-hq.md` | 본사 관점 네트워크 분석 — 매장 비교·발주 현황 |
| `.claude/agents/foodguard-auditor.md` | 데이터 품질 감사 + 코드에서 원인 추적 |
| `.claude/agents/foodguard-reviewer.md` | FoodGuard 함정을 아는 코드 리뷰어 |
| `fgcli/` | 에이전트가 Bash로 호출하는 **읽기 전용** 데이터 CLI |

### 빠른 시작

```bash
cd FoodGuard
python -m fgcli whoami              # 시스템 파이썬으로 바로 동작 (venv 불필요)
python -m fgcli recommend 60006     # 발주 추천
python -m fgcli weekly-all --as hq  # 전 매장 주간 매출
```

자격증명은 `ai-service/.env`의 `FOODGUARD_OWNER_*` / `FOODGUARD_HQ_*` 4줄입니다
(이 파일은 `.gitignore`에 있습니다). 토큰은 OS 임시 디렉터리에 55분간 캐시됩니다.

Claude Code에서는 `/agents`로 목록을 확인하고, 메인 세션에서 질문하면
설명(`description`)을 보고 적절한 에이전트가 자동으로 선택됩니다.

### 핵심 설계 세 가지

**① 에이전트는 자기 자격증명을 갖지 않는다**
`fgcli`는 서비스 계정이 아니라 **사용자 계정의 JWT**로 호출합니다. 덕분에 백엔드의
역할 검사(`@PreAuthorize`)와 매장 소유권 검사(`StoreAccessGuard`)가 에이전트에도
그대로 적용되고, 별도의 에이전트 권한 모델이 필요 없습니다.

**② 쓰기 커맨드를 만들지 않은 것이 안전 경계다**
`fgcli`에는 발주 생성·상태 변경 커맨드가 아예 없습니다. 쓰기는 사람이 웹 UI에서 합니다.

**③ 권한 거부는 예외가 아니라 결과다**
권한 밖 호출은 `{"error": "forbidden", "action": "우회하지 말고 사용자에게 보고하세요"}`로
돌아옵니다. 우회 방법(`--as hq`로 바꾸라는 등)을 **의도적으로 알려주지 않습니다** —
그걸 적으면 점주 권한 에이전트가 그대로 따라 해 권한 경계를 넘습니다.

## 이 자산을 쓸 때 꼭 기억할 5가지

1. **발주 상태는 7종입니다** — `REQUESTED / APPROVED / HQ_SENT / DRIVER_RECEIVED / DONE / REJECTED / CANCELLED` (`PENDING/RECEIVED`는 구버전). 재고 증가는 `DONE` 전환에서만. → `01` §3
2. **`confidence`는 확률이 아닙니다.** 0~100 스케일의 휴리스틱 점수입니다. → `03` §5
3. **현재 판매 데이터는 합성 데이터입니다.** 요일 효과 + ±10% 노이즈만 들어 있어 모델 성능의 근거가 되지 못합니다. → `05` §3
4. **역할 검사 + 매장 소유권 검사가 모두 서버에 있습니다.** 에이전트는 사용자 JWT를 그대로 위임받아 호출하므로 같은 제한을 받습니다. → `04` §8
5. **`POST /api/sales`는 재고를 실제로 차감합니다.** 테스트·백필에 쓰면 안 됩니다. → `04` §2

## 미구현이지만 화면은 있는 기능 (= 에이전트 기회 영역)

폐기 예측(`/waste-prediction`), 기부(`/donations`), 발주 QR 스캔·기사 수령 플로우는
**프론트엔드 서비스 코드만 있고 백엔드가 없습니다** (`02` §4).
FoodGuard의 원래 목표(음식물 폐기 감축)에 가장 직결되는 영역이므로,
에이전트로 먼저 구현하면 기능 완성과 차별화를 동시에 얻을 수 있습니다.
