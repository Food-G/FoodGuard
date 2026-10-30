# -*- coding: utf-8 -*-
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

NAVY = RGBColor(0x1A, 0x23, 0x7E)
GREEN = RGBColor(0x2E, 0x7D, 0x32)
ORANGE = RGBColor(0xE6, 0x51, 0x00)
GRAY = RGBColor(0x42, 0x42, 0x42)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

BLANK = prs.slide_layouts[6]


def add_slide():
    return prs.slides.add_slide(BLANK)


def add_bg(slide, color):
    shape = slide.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    shape.shadow.inherit = False
    slide.shapes._spTree.remove(shape._element)
    slide.shapes._spTree.insert(2, shape._element)
    return shape


def add_title(slide, text, top=Inches(0.4), color=NAVY, size=32, left=Inches(0.6), width=Inches(12.1)):
    box = slide.shapes.add_textbox(left, top, width, Inches(1.0))
    tf = box.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    run = p.add_run()
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = True
    run.font.color.rgb = color
    return box


def add_bullets(slide, items, top=Inches(1.5), left=Inches(0.7), width=Inches(11.9), height=Inches(5.5),
                 size=18, color=GRAY, line_space=1.15):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    first = True
    for item in items:
        if isinstance(item, tuple):
            text, level = item
        else:
            text, level = item, 0
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.level = level
        run = p.add_run()
        prefix = "" if level == 0 else "- "
        run.text = f"{prefix}{text}"
        run.font.size = Pt(size if level == 0 else size - 3)
        run.font.color.rgb = color
        run.font.bold = (level == 0)
        p.space_after = Pt(8 if level == 0 else 4)
        p.line_spacing = line_space
    return box


def add_footer(slide, text):
    box = slide.shapes.add_textbox(Inches(0.6), Inches(7.05), Inches(12), Inches(0.35))
    p = box.text_frame.paragraphs[0]
    run = p.add_run()
    run.text = text
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)


# ---------- Slide 1: Title ----------
s = add_slide()
add_bg(s, NAVY)
box = s.shapes.add_textbox(Inches(1), Inches(2.6), Inches(11.3), Inches(1.5))
p = box.text_frame.paragraphs[0]
run = p.add_run()
run.text = "FoodGuard"
run.font.size = Pt(60)
run.font.bold = True
run.font.color.rgb = WHITE

box2 = s.shapes.add_textbox(Inches(1), Inches(3.9), Inches(11.3), Inches(1.0))
p2 = box2.text_frame.paragraphs[0]
run2 = p2.add_run()
run2.text = "지구를 위한 스마트 식자재 관리 · 발주 · 수요예측 플랫폼"
run2.font.size = Pt(24)
run2.font.color.rgb = RGBColor(0xCF, 0xD8, 0xFF)

box3 = s.shapes.add_textbox(Inches(1), Inches(6.4), Inches(11.3), Inches(0.6))
p3 = box3.text_frame.paragraphs[0]
run3 = p3.add_run()
run3.text = "Backend: Spring Boot · Frontend: React/TypeScript · AI Service: FastAPI"
run3.font.size = Pt(16)
run3.font.color.rgb = RGBColor(0x9F, 0xAB, 0xDA)

# ---------- Slide 2: 프로젝트 개요 ----------
s = add_slide()
add_title(s, "프로젝트 개요")
add_bullets(s, [
    "식자재 발주부터 판매, AI 수요예측, 잔여 재고 기부까지 가맹점-본사 전체 흐름을 다루는 통합 플랫폼",
    ("문제 의식", 1),
    ("식자재 폐기로 인한 손실과 환경 부담을 줄이고, 수요예측 기반으로 적정 발주량을 추천", 2),
    ("역할 구조", 1),
    ("OWNER(가맹점주): 재고·메뉴·판매·예측·기부 관리", 2),
    ("HQ_ADMIN(본사 관리자): 전 가맹점 통합 관리, 발주 승인/배송 관리, 통계", 2),
    ("기술 스택", 1),
    ("Frontend: React + TypeScript + Vite + MUI (포트 5173)", 2),
    ("Backend: Spring Boot 3.x + Java 17 + JPA, DB: TiDB Cloud (MySQL 호환) (포트 8080)", 2),
    ("AI Service: FastAPI + Python 3.11, RandomForest (포트 8000)", 2),
], size=18)
add_footer(s, "FoodGuard Portfolio")

# ---------- Slide 3: 시스템 아키텍처 ----------
s = add_slide()
add_title(s, "시스템 아키텍처")
cols = [
    ("Frontend", "React + TypeScript\nVite / MUI", GREEN, [
        "역할 기반 라우팅 (OWNER / HQ_ADMIN)",
        "ECharts 데이터 시각화",
        "WebSocket(STOMP) 실시간 배달 추적",
        "QR 스캔/표시 (검수 워크플로우)",
    ]),
    ("Backend", "Spring Boot 3 + JPA\nJWT 인증", NAVY, [
        "13개 REST 컨트롤러",
        "JWT Stateless 인증, BCrypt",
        "WebSocket(STOMP) 배달 위치 중계",
        "TiDB Cloud(MySQL 호환) 연동",
    ]),
    ("AI Service", "FastAPI + Python\nRandomForest", ORANGE, [
        "기상청 단기/중기예보 연동",
        "메뉴별 7일 판매량 예측",
        "데이터량별 3단계 신뢰도 전략",
        "폐기량 예측 → 기부 추천",
    ]),
]
col_w = Inches(3.95)
gap = Inches(0.25)
left0 = Inches(0.6)
for i, (name, sub, color, items) in enumerate(cols):
    left = Emu(left0 + i * (col_w + gap))
    head = s.shapes.add_shape(1, left, Inches(1.5), col_w, Inches(1.1))
    head.fill.solid()
    head.fill.fore_color.rgb = color
    head.line.fill.background()
    tf = head.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = name
    r.font.size = Pt(22)
    r.font.bold = True
    r.font.color.rgb = WHITE
    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run()
    r2.text = sub
    r2.font.size = Pt(12)
    r2.font.color.rgb = WHITE

    body = s.shapes.add_textbox(left, Inches(2.8), col_w, Inches(3.8))
    btf = body.text_frame
    btf.word_wrap = True
    first = True
    for it in items:
        bp = btf.paragraphs[0] if first else btf.add_paragraph()
        first = False
        br = bp.add_run()
        br.text = f"• {it}"
        br.font.size = Pt(14)
        br.font.color.rgb = GRAY
        bp.space_after = Pt(10)
        bp.line_spacing = 1.2
add_footer(s, "FoodGuard Portfolio")

# ---------- Section divider helper ----------
def add_section(title_text, subtitle_text, color):
    s = add_slide()
    add_bg(s, color)
    box = s.shapes.add_textbox(Inches(1), Inches(3.0), Inches(11.3), Inches(1.2))
    p = box.text_frame.paragraphs[0]
    r = p.add_run()
    r.text = title_text
    r.font.size = Pt(48)
    r.font.bold = True
    r.font.color.rgb = WHITE
    box2 = s.shapes.add_textbox(Inches(1), Inches(4.1), Inches(11.3), Inches(0.8))
    p2 = box2.text_frame.paragraphs[0]
    r2 = p2.add_run()
    r2.text = subtitle_text
    r2.font.size = Pt(20)
    r2.font.color.rgb = RGBColor(0xE8, 0xE8, 0xE8)
    return s

# ---------- Backend Section ----------
add_section("Backend", "Spring Boot 기반 REST API · 13개 컨트롤러", NAVY)

backend_slides = [
    ("백엔드 기능 ① 인증 · 매장 · 재고", [
        ("AuthController (/api/auth)", 0),
        ("회원가입, 로그인 (JWT 토큰 발급)", 1),
        ("StoreController (/api/stores)", 0),
        ("매장 생성/조회/수정/삭제, 사용자별 매장 목록 조회", 1),
        ("IngredientController (/api/ingredients)", 0),
        ("식자재 마스터 데이터 등록/조회/수정/삭제 (단위: kg/L/개)", 1),
        ("InventoryController (/api/inventory)", 0),
        ("매장별 재고 생성/조회/수정/삭제", 1),
    ]),
    ("백엔드 기능 ② 메뉴 · 판매 · 발주", [
        ("MenuController / MenuIngredientController", 0),
        ("메뉴 CRUD, 메뉴-식자재 구성(BOM) 관리", 1),
        ("SalesDataController (/api/sales)", 0),
        ("판매 데이터 기록·조회 (기간별 조회 지원)", 1),
        ("OrderRequestController (/api/orders)", 0),
        ("발주 생성, AI 기반 발주 추천/자동 발주", 1),
        ("3단계 검수: 본사 발송 → 배달기사 수령 → 점주 수령 (QR 스캔)", 1),
    ]),
    ("백엔드 기능 ③ 배달 · 알림 · 기부 · AI 예측", [
        ("DeliveryController (/api/delivery)", 0),
        ("토큰 기반 배달 조회, WebSocket 실시간 GPS 위치 공유", 1),
        ("NotificationController (/api/notifications)", 0),
        ("알림 생성/미읽음 조회/읽음 처리", 1),
        ("DonationController (/api/donations)", 0),
        ("잔여 식자재 기부 요청/완료/취소 관리", 1),
        ("PredictionController · WastePredictionController", 0),
        ("AI 판매 예측 결과 조회/트리거, 폐기량 예측 요약", 1),
    ]),
    ("AI Service (FastAPI) 연동", [
        ("POST /prediction/store/{store_id}", 0),
        ("매장 전체 메뉴 판매량 예측 실행 및 DB 저장", 1),
        ("POST /prediction/store/{store_id}/menu/{menu_id}", 0),
        ("날씨 데이터를 반영한 특정 메뉴 판매량 예측", 1),
        ("POST /training/store/{store_id}", 0),
        ("매장 데이터 기반 모델 재학습", 1),
        ("예측 신뢰도 전략", 0),
        ("데이터 7개 미만: 예측 불가 / 7~29개: 요일 평균 / 30개 이상: RandomForest(날씨 피처 포함)", 1),
    ]),
    ("보안 · 인프라 설계", [
        ("JWT 기반 Stateless 인증 + BCrypt 비밀번호 해싱", 0),
        ("공개 엔드포인트 최소화 (회원가입/로그인/QR스캔/WebSocket만 예외)", 0),
        ("CSRF 비활성화 (REST API 특성 반영)", 0),
        ("외부 API(기상청) 연동: 연결 5초 / 읽기 60초 타임아웃 설정", 0),
        ("DB: TiDB Cloud (MySQL 호환, 분산 클라우드 DB)", 0),
    ]),
]
for title, items in backend_slides:
    s = add_slide()
    add_title(s, title, color=NAVY)
    add_bullets(s, items, size=19)
    add_footer(s, "FoodGuard Portfolio · Backend")

# ---------- Frontend Section ----------
add_section("Frontend", "React + TypeScript · 역할 기반(OWNER / HQ_ADMIN) 화면 구성", GREEN)

frontend_slides = [
    ("프론트엔드 구조 · 인증", [
        ("역할 기반 접근 제어 (RBAC)", 0),
        ("OWNER(가맹점주): 단일 가맹점 운영 중심 화면", 1),
        ("HQ_ADMIN(본사): 다중 가맹점 통합 관리 화면", 1),
        ("Login / Signup", 0),
        ("JWT 로그인, 역할 선택(OWNER/HQ_ADMIN) 회원가입", 1),
        ("Daum 주소 API로 가맹점 주소 검색 및 시도/구군 선택", 1),
    ]),
    ("OWNER 화면 ① 운영 기본", [
        ("Dashboard", 0),
        ("그래디언트 타일 UI로 각 기능 진입, 대기 항목 배지 표시", 1),
        ("Inventory / Ingredients", 0),
        ("재고 현황, 메뉴별 식자재 구성(BOM) 관리, 발주단위↔레시피단위 변환", 1),
        ("MenuManagement / SalesEntry", 0),
        ("메뉴 CRUD, 판매 기록 입력 (수량×가격 자동 계산)", 1),
        ("POS", 0),
        ("매장 테이블 캔버스 레이아웃, 테이블별 주문/결제 처리", 1),
    ]),
    ("OWNER 화면 ② 예측 · 발주 · 기부", [
        ("Predictions", 0),
        ("AI 판매 예측을 ECharts 라인/바 차트로 시각화, 즉시 예측 트리거", 1),
        ("Orders", 0),
        ("발주 현황(대기→승인→발송→수령→완료) 추적, QR 스캔으로 검수", 1),
        ("WastePrediction / DonationHistory", 0),
        ("폐기 예상 식자재 산출 → 기부(고아원/양로원/푸드뱅크 등) 등록 및 이력 관리", 1),
        ("DeliveryDriver(Group)", 0),
        ("배달기사용 화면, Leaflet 지도 + WebSocket 실시간 GPS 위치 공유", 1),
    ]),
    ("HQ_ADMIN 화면", [
        ("StoreManagement", 0),
        ("전체 가맹점 목록 CRUD, 지역별 검색, 발주 상태 탭", 1),
        ("AdminOrders", 0),
        ("전사 발주 승인/배송 단계 관리, QR 코드 생성·인쇄(QrCodeDisplay)", 1),
        ("Stats", 0),
        ("월별 매출 vs 폐기 비용 추세, 가맹점별 폐기 비중 차트(ECharts)", 1),
    ]),
    ("기술 하이라이트", [
        ("QrScanner / QrCodeDisplay", 0),
        ("Html5Qrcode 기반 웹캠 QR 스캔 + QRCodeSVG 생성/인쇄 — 발주 검수 무결성 보장", 1),
        ("useConfirm 훅", 0),
        ("Context API + Promise 기반 전역 확인 대화창 (삭제/상태변경 시 재사용)", 1),
        ("useMyStore 훅", 0),
        ("인증 사용자의 가맹점 ID 자동 조회 — 대부분의 OWNER 페이지에서 공통 사용", 1),
        ("실시간 배달 추적", 0),
        ("WebSocket(STOMP) + Geolocation API로 배달기사 위치를 점주/본사에 실시간 전송", 1),
    ]),
]
for title, items in frontend_slides:
    s = add_slide()
    add_title(s, title, color=GREEN)
    add_bullets(s, items, size=18)
    add_footer(s, "FoodGuard Portfolio · Frontend")

# ---------- Development Process Section ----------
add_section("개발 과정", "총 44개 커밋 · 2026-04-05 ~ 2026-06-05 (약 2개월)", ORANGE)

process_slides = [
    ("개발 타임라인 ① 초기 세팅~디자인 (04-05 ~ 04-17)", [
        ("1단계: 프로젝트 초기 세팅", 0),
        ("Spring Boot 골격, JWT 인증, 매출 CRUD API 기본 틀 구축", 1),
        ("2단계: ERD 구조 반영", 0),
        ("설계한 ERD에 맞춰 JPA 엔티티/리포지토리 재정비", 1),
        ("3단계: 프론트엔드 프로젝트 구성", 0),
        ("React+TS+Vite+MUI 신규 구성, 백엔드 연동 전 디자인 골격 마련", 1),
    ]),
    ("개발 타임라인 ② 협업 & UI 고도화 (04-24 ~ 05-08)", [
        ("4단계: 협업 체계 구축", 0),
        ("회원가입을 DB와 완전 연동, 팀 단위 브랜치 협업 본격화", 1),
        ("5단계: 핵심 도메인 CRUD 완성 + AI 서비스 신설", 0),
        ("재고/메뉴/식자재 CRUD 완성, UI 전면 리디자인, FastAPI AI 서비스 신설", 1),
    ]),
    ("개발 타임라인 ③ AI 예측 & 배달 (05-15 ~ 05-22)", [
        ("6단계: AI 수요예측 연동", 0),
        ("기상청 API + RandomForest로 7일 판매량 예측, 예측→발주 추천 연결", 1),
        ("7단계: 배달 현황 & 카카오 주소 API", 0),
        ("여러 팀원 브랜치 머지 충돌 해결, 주소 검색 개선, 배달 추적 착수", 1),
        ("8단계: POS 시스템 & 배달기사 페이지", 0),
        ("매장 내 POS(테이블 주문/결제) 구현, 배달기사 모바일 웹 GPS 공유", 1),
    ]),
    ("개발 타임라인 ④ 완성도 향상 (05-29 ~ 06-05, 최신)", [
        ("9단계: AI 모델 보완 & 관리자 페이지 정비", 0),
        ("예측 신뢰도 로직 개선, HQ_ADMIN 통합 관리 화면 재정비", 1),
        ("10단계: QR 검수 워크플로우 완성 & 알림 UX 고도화", 0),
        ("타일형 홈 구성, QR 기반 3단계 검수 완성", 1),
        ("알림 시스템 6차례 반복 개선: 호버 읽음처리 → 중복 알림 제거 → 재오픈 버그 수정", 1),
        ("발주 취소 정책 변경 후 부작용 발견 → 즉시 revert (빠른 피드백 루프)", 1),
    ]),
    ("기술적으로 강조할 변경 포인트", [
        ("AI 수요예측 파이프라인: 데이터량에 따른 3단계 신뢰도 전략 설계", 0),
        ("3단계 QR 검수 워크플로우: 본사→배달기사→점주, 단계별 무결성 보장", 0),
        ("WebSocket 실시간 배달 추적: STOMP + Geolocation API 연동", 0),
        ("역할 기반 접근 제어(RBAC): OWNER / HQ_ADMIN 라우팅·화면 분리", 0),
        ("반복적 UX 개선 사이클: 알림 기능을 사용성 피드백 기반으로 지속 개선", 0),
    ]),
]
for title, items in process_slides:
    s = add_slide()
    add_title(s, title, color=ORANGE, size=26)
    add_bullets(s, items, size=18)
    add_footer(s, "FoodGuard Portfolio · 개발 과정")

# ---------- Closing ----------
s = add_slide()
add_bg(s, NAVY)
box = s.shapes.add_textbox(Inches(1), Inches(3.0), Inches(11.3), Inches(1.2))
p = box.text_frame.paragraphs[0]
r = p.add_run()
r.text = "감사합니다"
r.font.size = Pt(44)
r.font.bold = True
r.font.color.rgb = WHITE
box2 = s.shapes.add_textbox(Inches(1), Inches(4.0), Inches(11.3), Inches(0.8))
p2 = box2.text_frame.paragraphs[0]
r2 = p2.add_run()
r2.text = "FoodGuard — 지구를 위한 스마트 식자재 관리 플랫폼"
r2.font.size = Pt(18)
r2.font.color.rgb = RGBColor(0xCF, 0xD8, 0xFF)

prs.save("FoodGuard_포트폴리오.pptx")
print("Saved FoodGuard_포트폴리오.pptx with", len(prs.slides.__iter__.__self__._sldIdLst), "slides")
