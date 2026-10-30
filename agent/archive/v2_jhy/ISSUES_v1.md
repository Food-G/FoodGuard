# 문제 목록

에이전트와 사람이 함께 쓰는 문제 목록. 새 문제는 맨 아래에 다음 번호로 추가한다.
심각도: 상(서비스·보안·보고서 수치에 직접 영향) / 중(기능 오류·오해 소지) / 하(정리·품질)
상태: 열림 / 진행 / 해결 / 사람 결정 필요

| ID | 내용 | 근거 | 심각도 | 상태 | 관련 단계 |
|---|---|---|---|---|---|
| I-01 | 프론트 `tsc` 오류 4건 (미사용 선언) | `AdminDashboard.tsx:4`, `AdminOrders.tsx:43,174`, `Ingredients.tsx:17` | 하 | 해결 (STEP 2) | STEP 2 |
| I-02 | 문서와 코드 불일치: CLAUDE.md 모델 전략 표, `main.py` 설명, `uml/` 시퀀스가 옛 RandomForest 기준 | `ai-service/main.py:12`, `uml/sequence-prediction.md` | 하 | 해결 (STEP 3) | STEP 3 |
| I-03 | 프론트가 호출하는 매출 요약 API 3개가 백엔드에 없음. 본사 대시보드 목록까지 비어 보일 수 있음 | `frontend/src/services/salesService.ts:17-23`, `AdminDashboard.tsx:33` | 중 | 부분 해결 (STEP 4: 실제 호출되는 all-stores API만 구현, I-21 참고) | STEP 4 |
| I-04 | 본사 통계 화면이 하드코딩 가상 수치("폐기율 12.5% 감소") | `frontend/src/pages/admin/Stats.tsx` | 중 | 부분 해결 (STEP 5: 예시 데이터 안내 표시. 실제 데이터 연결은 I-08 이후) | STEP 5 |
| I-05 | 2~7일 앞 예측에서 `lag_7`이 같은 요일을 가리키지 않음 | `ai-service/ml/feature_engineering.py:146-153` | 상 | 해결 (STEP 6) | STEP 6 |
| I-06 | 신뢰도 계산이 시간 순서를 무시한 KFold 교차검증 | `ai-service/ml/demand_predictor.py:150` | 중 | 부분 해결 (STEP 7: 오프라인 시간순 백테스트 도구로 대체 측정 가능. 화면 신뢰도 계산 자체는 그대로) | STEP 7 |
| I-07 | 재예측 시 미래 예측을 지우고 다시 써서 지난 예측과 실제를 비교할 수 없음 | `ai-service/services/data_service.py:77` | 상 | 사람 결정 필요 (공용 DB 변경) | STEP 9 |
| I-08 | 실제 폐기량을 기록하는 곳이 없음 (폐기율 측정 불가) | `backend/.../entity/Inventory.java` | 상 | 사람 결정 필요 (공용 DB 변경) | STEP 9 |
| I-09 | 발주 추천이 7일 일별 분위수를 합산, 유통기한·발주 주기 미반영 → 과잉 발주 경향 | `backend/.../service/OrderRequestService.java` `recommend()` | 중 | 열림 | 미배정 |
| I-10 | 발주 추천 미리보기 화면 없음, 승인·수정·거절 기록 없음 (추천 활용률 측정 불가) | `frontend/src/pages/Orders.tsx:133` | 중 | 사람 결정 필요 | STEP 9 |
| I-11 | 더미 판매 데이터 생성 스크립트가 저장소에 없어 재현 불가 | `.claude/settings.local.json`에 이름만 남음 | 중 | 사람 결정 필요 (보유 팀원 확인) | 미배정 |
| I-12 | DB 접속 정보 미입력 (백엔드 `application-local.properties`, `ai-service/.env`) → 서버 기동 불가, `foodguard-ai` MCP 연결 실패 | 2026-10-16 점검 | 상 | 사람 결정 필요 (TiDB 사용 여부·접속 정보) | STEP 8 |
| I-13 | GitHub Dependabot 경고: 의존성 취약점 131개 (치명 3, 높음 65) | 2026-10-16 푸시 메시지 | 중 | 열림 | 미배정 |
| I-14 | 옛 비밀 값이 git 이력에 남아 있음. 기상청 키는 교체 완료, TiDB 비밀번호 교체 여부 미확인 | 커밋 `5d60e6f` 이전 이력 | 상 | 사람 결정 필요 | — |
| I-15 | 판매 기록에 시각이 없어 시간대 예측·품절 추정 불가 | `backend/.../entity/SalesData.java` | 하 | 열림 | 미배정 |
| I-16 | 기본 테스트 `contextLoads`가 실제 DB 접속을 요구해, DB 정보 없이는 항상 실패 (`gradlew test` 전체 실패로 보임) | `backend/src/test/java/com/foodguard/FoodguardApplicationTests.java`, 원인 `UnknownHostException: <host>` | 하 | 열림 | 미배정 |
| I-17 | AI 서비스 venv에 `xgboost==3.2.0` 미설치 → 예측 모델 import 실패 (새 PC 환경 설정 누락) | `python -c "import ml.demand_predictor"` → `ModuleNotFoundError: xgboost` | 중 | 해결 (xgboost 3.2.0 설치, import 확인) | 미배정 |
| I-19 | 본사 발주 화면에 "기사 수령 처리" 버튼이 없음. 처리 함수만 있고 연결이 안 돼 있었음(STEP 2에서 미사용 함수 제거). `orderService.driverReceive`도 이제 호출처 없음. 기사 QR 스캔 외 수동 처리가 필요한지 결정 필요 | `frontend/src/services/orderService.ts`, 제거 전 `AdminOrders.tsx:174` | 하 | 사람 결정 필요 | 미배정 |
| I-18 | venv Python이 3.13.9인데 CLAUDE.md는 3.11로 명시. 고정 버전 패키지(numpy 1.26.4 등) 호환 확인 필요 | `venv/Scripts/python.exe --version` | 하 | 열림 | 미배정 |
| I-20 | `uml/sequence-prediction.md` 흐름이 실제와 다름: 다이어그램은 백엔드가 판매 데이터를 AI에 전송하고 예측을 백엔드가 저장한다고 하지만, 실제로는 AI 서비스가 DB를 직접 읽고 `PREDICTION_RESULT`에 저장. 경로도 `/predict/{storeId}` → 실제 `/api/predict/store/{id}`. `uml/architecture.md`의 `/predict-all` 엔드포인트도 없음 | `backend/.../service/PredictionService.java`, `ai-service/routers/prediction.py` | 하 | 열림 | 미배정 |
| I-21 | `salesService.getTodaySummary`, `getWeeklySummary`는 프론트 어디서도 호출하지 않는데 백엔드에 대응 API가 없음. 화면을 만들 계획이 없다면 서비스 정의를 지우고, 있다면 화면과 함께 구현 필요 | `frontend/src/services/salesService.ts:16-21`, `git grep getTodaySummary` 호출처 0건 | 하 | 사람 결정 필요 | 미배정 |
| I-22 | STEP 4의 매출 집계 JPQL(`SalesDataRepository.sumRevenueByStore`)은 DB 없이 실행 검증하지 못함. 테스트는 저장소를 mock 처리. DB 연결 후 백엔드 기동 시 쿼리 검증 필요 | `backend/.../repository/SalesDataRepository.java` | 중 | 열림 | STEP 8 |
| I-23 | 학습 시 lag·rolling 피처가 "n일 전"이 아니라 "n행 전"으로 계산됨(`shift(n)`). 판매 기록에 빠진 날이 있으면 학습과 예측의 lag 의미가 어긋남. 빠진 날을 0 또는 결측으로 채운 뒤 계산할지 결정 필요 | `ai-service/ml/feature_engineering.py` `add_lag_features`, `add_rolling_features` | 중 | 열림 | 미배정 |
| I-24 | 합성 데이터(요일 패턴 + 10% 노이즈) 백테스트에서 FoodGuard 모델 WAPE 11.8%가 단순 "요일 평균" 8.9%보다 나쁨. 팀 더미 데이터가 같은 구조(요일 효과 + ±10% 노이즈)라 실데이터 평가에서도 같은 결과일 가능성. 보고서에 모델 우수성을 쓰기 전에 실데이터 백테스트(STEP 8)와 공개 데이터 검증 필요. 모델 개선 후보: 글로벌 모델, 요일 평균을 피처/베이스로 사용 | `python -m evaluation.backtest` 결과 (LOG STEP 7) | 상 | 열림 | STEP 8 |
