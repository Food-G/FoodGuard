# -*- coding: utf-8 -*-
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

FONT = "맑은 고딕"

DARKGREEN = RGBColor(0x14, 0x5A, 0x28)
GREEN = RGBColor(0x1E, 0x8E, 0x3E)
BLUE = RGBColor(0x1A, 0x73, 0xE8)
ORANGE = RGBColor(0xF5, 0x9E, 0x0B)
PURPLE = RGBColor(0x7B, 0x3F, 0xE4)
TEAL = RGBColor(0x00, 0x89, 0x7B)
BLACK_TEXT = RGBColor(0x21, 0x25, 0x29)
GRAY_TEXT = RGBColor(0x5F, 0x6B, 0x7A)
LIGHT_GRAY_BG = RGBColor(0xF4, 0xF6, 0xF8)
PAGE_NUM_GRAY = RGBColor(0xC0, 0xC8, 0xD0)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GREEN_BG = RGBColor(0xE6, 0xF4, 0xEA)
ME = ORANGE  # 지현윤 개인 포인트 컬러

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def add_slide():
    return prs.slides.add_slide(BLANK)


def rect(slide, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE):
    sp = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    sp.fill.solid()
    sp.fill.fore_color.rgb = fill
    sp.line.fill.background()
    sp.shadow.inherit = False
    return sp


def text(slide, x, y, w, h, runs, align=PP_ALIGN.LEFT, anchor=None, line_spacing=1.0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    if anchor:
        tf.vertical_anchor = anchor
    first = True
    for para_runs in runs:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.alignment = align
        p.line_spacing = line_spacing
        for r in para_runs:
            run = p.add_run()
            run.text = r["t"]
            run.font.size = Pt(r.get("size", 14))
            run.font.bold = r.get("bold", False)
            run.font.color.rgb = r.get("color", BLACK_TEXT)
            run.font.name = FONT
    return box


def simple_text(slide, x, y, w, h, t, size=14, bold=False, color=BLACK_TEXT, align=PP_ALIGN.LEFT, anchor=None):
    return text(slide, x, y, w, h, [[{"t": t, "size": size, "bold": bold, "color": color}]], align=align, anchor=anchor)


def header(slide, eyebrow, title, page_num, accent=ME):
    rect(slide, 0, 0, 13.333, 1.15, WHITE)
    rect(slide, 0.5, 0.34, 0.14, 0.50, accent)
    simple_text(slide, 0.78, 0.20, 10.0, 0.4, eyebrow, size=12, bold=True, color=accent)
    simple_text(slide, 0.78, 0.48, 11.0, 0.6, title, size=26, bold=True, color=BLACK_TEXT)
    if page_num:
        simple_text(slide, 12.0, 0.40, 0.9, 0.5, page_num, size=13, bold=True, color=PAGE_NUM_GRAY, align=PP_ALIGN.RIGHT)
    rect(slide, 0, 1.15, 13.333, 0.03, accent)


def card(slide, x, y, w, h, title_t, desc_t, accent):
    rect(slide, x, y, w, h, LIGHT_GRAY_BG)
    rect(slide, x, y, w, 0.10, accent)
    simple_text(slide, x + 0.18, y + 0.22, w - 0.36, 0.5, title_t, size=14.5, bold=True, color=BLACK_TEXT)
    simple_text(slide, x + 0.18, y + 0.68, w - 0.36, h - 0.8, desc_t, size=11.5, bold=False, color=GRAY_TEXT)


def step_row(slide, y, h, num, title_t, desc_t, accent, label=None):
    rect(slide, 0.78, y, 11.78, h, LIGHT_GRAY_BG)
    rect(slide, 0.78, y, 0.12, h, accent)
    circ = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.05), Inches(y + (h - 0.6) / 2), Inches(0.6), Inches(0.6))
    circ.fill.solid()
    circ.fill.fore_color.rgb = accent
    circ.line.fill.background()
    circ.shadow.inherit = False
    tf = circ.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = str(num)
    r.font.size = Pt(18)
    r.font.bold = True
    r.font.color.rgb = WHITE
    r.font.name = FONT
    tx0 = 1.95
    if label:
        rrect = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(tx0), Inches(y + 0.12), Inches(0.95), Inches(0.32))
        rrect.fill.solid()
        rrect.fill.fore_color.rgb = accent
        rrect.line.fill.background()
        rrect.shadow.inherit = False
        rtf = rrect.text_frame
        rp = rtf.paragraphs[0]
        rp.alignment = PP_ALIGN.CENTER
        rr = rp.add_run()
        rr.text = label
        rr.font.size = Pt(10)
        rr.font.bold = True
        rr.font.color.rgb = WHITE
        rr.font.name = FONT
        simple_text(slide, tx0 + 1.10, y + 0.10, 8.70, 0.4, title_t, size=15, bold=True, color=BLACK_TEXT)
    else:
        simple_text(slide, tx0, y + 0.10, 9.85, 0.4, title_t, size=15, bold=True, color=BLACK_TEXT)
    simple_text(slide, tx0, y + 0.52, 9.85, h - 0.58, desc_t, size=12, bold=False, color=GRAY_TEXT)


# ============================================================
# Slide 1: Title
# ============================================================
s = add_slide()
rect(s, 0, 0, 13.333, 7.5, DARKGREEN)
rect(s, -1.0, 4.70, 15.50, 1.50, GREEN)
rect(s, 0.90, 1.05, 0.90, 0.16, ORANGE)
simple_text(s, 0.85, 1.30, 11.0, 0.6, "CAPSTONE DESIGN · 창신대학교 컴퓨터공학과 · 개인 포트폴리오", size=14, bold=True, color=RGBColor(0xBF, 0xE5, 0xCB))
simple_text(s, 0.82, 2.00, 12.0, 1.4, "지현윤", size=58, bold=True, color=WHITE)
simple_text(s, 0.85, 3.15, 11.6, 1.0, "FoodGuard 프로젝트 — 시스템 통합 · 알림 시스템 설계", size=19, bold=False, color=RGBColor(0xDF, 0xF1, 0xE5))
text(s, 0.85, 5.85, 11.6, 0.6, [[
    {"t": "팀 푸드가드  ·  GitHub: jhy / jihwan  ·  2026.06", "size": 15, "bold": True, "color": WHITE},
]])

# ============================================================
# Slide 2: 프로젝트 한눈에 보기
# ============================================================
s = add_slide()
header(s, "PROJECT IN BRIEF", "프로젝트 한눈에 보기", "02", accent=GREEN)
text(s, 0.78, 1.45, 11.8, 0.9, [[
    {"t": "FoodGuard는 ", "size": 16, "color": BLACK_TEXT},
    {"t": "AI 수요예측 기반 식자재 발주·재고 관리", "size": 16, "bold": True, "color": GREEN},
    {"t": "로 음식점 폐기를 줄이는 5인 팀 캡스톤 프로젝트입니다.", "size": 16, "color": BLACK_TEXT},
]])
cards = [
    ("Frontend", "React + TypeScript + Vite (MUI)", GREEN),
    ("Backend", "Spring Boot · JPA · JWT 인증", BLUE),
    ("AI Service", "FastAPI · RandomForest 수요예측", ORANGE),
    ("팀 구성", "5인 (서준호·김지환·정태현·지현윤·몽흐데르겔)", PURPLE),
]
for i, (t1, t2, c) in enumerate(cards):
    x = 0.78 + i * (2.92 + 0.16)
    card(s, x, 2.50, 2.92, 1.55, t1, t2, c)
rect(s, 0.78, 4.45, 11.78, 1.85, LIGHT_GREEN_BG)
text(s, 1.05, 4.68, 11.2, 1.5, [
    [{"t": "지현윤이 이 프로젝트에서 한 일", "size": 15, "bold": True, "color": DARKGREEN}],
    [{"t": "✓  ", "size": 13, "bold": True, "color": GREEN}, {"t": "알림 시스템 UX를 5단계 반복 개선 (커밋 전부 단독 작성)", "size": 13, "color": BLACK_TEXT}],
    [{"t": "✓  ", "size": 13, "bold": True, "color": GREEN}, {"t": "정책 변경의 데이터 리스크를 인지하고 즉시 롤백 결정", "size": 13, "color": BLACK_TEXT}],
    [{"t": "✓  ", "size": 13, "bold": True, "color": GREEN}, {"t": "4개 브랜치(junho·jihwan·hyeon·jhy) 작업 차이를 분석·통합", "size": 13, "color": BLACK_TEXT}],
], line_spacing=1.35)

# ============================================================
# Slide 3: 담당 역할 개요
# ============================================================
s = add_slide()
header(s, "MY ROLE", "담당 역할 개요", "03")
rect(s, 0.78, 1.50, 3.85, 5.45, ME)
simple_text(s, 1.05, 1.85, 3.30, 0.6, "지현윤", size=30, bold=True, color=WHITE)
simple_text(s, 1.05, 2.45, 3.30, 0.4, "GitHub: jhy / jihwan", size=12, bold=False, color=RGBColor(0xFF, 0xF1, 0xDF))
simple_text(s, 1.05, 2.78, 3.30, 0.7, "시스템 통합 · 배포", size=15, bold=True, color=WHITE)
text(s, 1.05, 3.60, 3.30, 3.0, [[
    {"t": "여러 브랜치(junho·jihwan·hyeon·jhy)에서 동시에 진행된 작업을 통합하는 전략을 세우고, 이벤트 기반 알림 UX 구조를 설계했습니다.", "size": 12.5, "color": RGBColor(0xFF, 0xF1, 0xDF)}
]], line_spacing=1.4)
simple_text(s, 4.95, 1.50, 7.60, 0.4, "담당 영역", size=14, bold=True, color=ME)
tags = ["대시보드", "알림 UX", "시스템 통합", "정책 실험"]
tx = 4.95
for tag in tags:
    tw = 0.5 + len(tag) * 0.155
    rrect = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(tx), Inches(1.92), Inches(tw), Inches(0.42))
    rrect.fill.solid()
    rrect.fill.fore_color.rgb = LIGHT_GREEN_BG
    rrect.line.fill.background()
    rrect.shadow.inherit = False
    rtf = rrect.text_frame
    rtf.word_wrap = False
    rp = rtf.paragraphs[0]
    rp.alignment = PP_ALIGN.CENTER
    rr = rp.add_run()
    rr.text = tag
    rr.font.size = Pt(11.5)
    rr.font.bold = True
    rr.font.color.rgb = GREEN
    rr.font.name = FONT
    tx += tw + 0.08
simple_text(s, 4.95, 2.60, 7.60, 0.4, "이 포트폴리오의 구성", size=14, bold=True, color=ME)
text(s, 4.95, 3.05, 7.60, 3.9, [
    [{"t": "①  ", "size": 13.5, "bold": True, "color": ME}, {"t": "알림 UX 반복 개선", "size": 13.5, "bold": True, "color": BLACK_TEXT}, {"t": "  — 실사용 피드백을 5단계에 걸쳐 코드로 풀어낸 과정", "size": 12.5, "color": GRAY_TEXT}],
    [{"t": "②  ", "size": 13.5, "bold": True, "color": ME}, {"t": "발주 취소 정책 실험과 롤백", "size": 13.5, "bold": True, "color": BLACK_TEXT}, {"t": "  — 데이터 정합성 리스크를 인지하고 빠르게 되돌린 의사결정", "size": 12.5, "color": GRAY_TEXT}],
    [{"t": "③  ", "size": 13.5, "bold": True, "color": ME}, {"t": "브랜치 통합", "size": 13.5, "bold": True, "color": BLACK_TEXT}, {"t": "  — 4개 브랜치의 차이를 분석하고 정리한 과정", "size": 12.5, "color": GRAY_TEXT}],
], line_spacing=1.3)

# ============================================================
# Slide 4: 핵심 기여 요약
# ============================================================
s = add_slide()
header(s, "MY CONTRIBUTION", "핵심 기여 요약 (GitHub blame 기준 실측)", "04")
contribs = [
    ("초기 디자인 구성", "63%", "백엔드-프론트 연동 전 레이아웃 구성 — MainLayout 코드 중 63% 작성", GREEN),
    ("알림 UX 반복 개선", "100%", "발주 알림뱃지, 호버 읽음처리, 자기알림 제거, 재오픈버그 수정 — 관련 커밋 전부 단독 작성", BLUE),
    ("발주 목록 삭제 기능 추가", "35%", "발주 목록 각 행에 삭제 아이콘 추가, 실수 방지 UX 고려 — Orders.tsx 코드 중 35% 작성", ORANGE),
    ("시스템 통합", "코드 외 영역", "브랜치 간 기능 정리 — 코드 통계로 측정되지 않는 영역", TEAL),
]
for i, (t1, pct, desc, c) in enumerate(contribs):
    y = 1.65 + i * 1.32
    h = 1.18
    rect(s, 0.78, y, 11.78, h, LIGHT_GRAY_BG)
    rect(s, 0.78, y, 0.12, h, c)
    simple_text(s, 1.05, y + 0.22, 4.5, 0.4, t1, size=15.5, bold=True, color=BLACK_TEXT)
    simple_text(s, 1.05, y + 0.68, 7.3, 0.4, desc, size=11, bold=False, color=GRAY_TEXT)
    simple_text(s, 10.30, y, 2.10, h, pct, size=17, bold=True, color=c, align=PP_ALIGN.CENTER, anchor=None)

# ============================================================
# Slide 5: 아키텍처 이해 (NEW) — 알림 시스템 End-to-End 흐름
# ============================================================
s = add_slide()
header(s, "ARCHITECTURE UNDERSTANDING", "아키텍처 이해 — 알림 시스템 End-to-End 흐름", "05", accent=TEAL)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "UI만 만든 게 아니라, 백엔드 API부터 프론트 폴링·상태 동기화까지 전체 흐름을 이해하고 설계했습니다", size=12.5, bold=True, color=GRAY_TEXT)
arch_steps = [
    ("DB · Entity", "Notification 엔티티\n(isRead 플래그)", GREEN),
    ("Backend API", "NotificationController\nPOST· /unread· /read", BLUE),
    ("Frontend 폴링", "Topbar.tsx\n30초마다 GET /unread", ORANGE),
    ("로컬 상태 병합", "기존 목록 + 신규만 추가\n(교체 아님)", PURPLE),
    ("UI 렌더링", "Badge 빨간 뱃지\n+ 호버 읽음처리", TEAL),
]
n = len(arch_steps)
gap = 0.18
cw = (11.78 - gap * (n - 1)) / n
for i, (t1, t2, c) in enumerate(arch_steps):
    x = 0.78 + i * (cw + gap)
    rect(s, x, 2.10, cw, 0.55, c, shape=MSO_SHAPE.OVAL)
    numtf = s.shapes[-1].text_frame
    nump = numtf.paragraphs[0]
    nump.alignment = PP_ALIGN.CENTER
    numr = nump.add_run()
    numr.text = str(i + 1)
    numr.font.size = Pt(18)
    numr.font.bold = True
    numr.font.color.rgb = WHITE
    numr.font.name = FONT
    rect(s, x, 2.95, cw, 2.30, LIGHT_GRAY_BG)
    rect(s, x, 2.95, cw, 0.08, c)
    simple_text(s, x + 0.10, 3.15, cw - 0.20, 0.6, t1, size=12.5, bold=True, color=BLACK_TEXT)
    simple_text(s, x + 0.10, 3.75, cw - 0.20, 1.40, t2.replace("\n", " "), size=9.5, bold=False, color=GRAY_TEXT)
    if i < n - 1:
        simple_text(s, x + cw - 0.04, 2.06, gap + 0.08, 0.55, "›", size=18, bold=True, color=GRAY_TEXT, align=PP_ALIGN.CENTER)
text(s, 0.78, 5.55, 11.8, 1.5, [
    [{"t": "왜 \"교체\"가 아니라 \"병합\"인가  ", "size": 13.5, "bold": True, "color": TEAL}],
    [{"t": "서버는 \"안읽음\" 목록만 내려줍니다. 매번 그대로 교체하면, 이미 읽은 알림이 다음 폴링에서 사라져버립니다. ", "size": 12, "color": GRAY_TEXT},
     {"t": "그래서 기존 로컬 목록은 유지하고 새 알림만 추가하도록 직접 병합 전략을 바꿨습니다.", "size": 12, "bold": True, "color": BLACK_TEXT}],
], line_spacing=1.35)

# ============================================================
# Slide 6: 딥다이브 ① 알림 UX 반복 개선 - 문제와 과정
# ============================================================
s = add_slide()
header(s, "DEEP DIVE ①", "알림 UX 반복 개선 — 무엇을, 왜 고쳤나", "06", accent=BLUE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "실제로 사용해보면서 발견한 불편함을 5개 커밋에 걸쳐 그때그때 해결했습니다", size=13, bold=True, color=GRAY_TEXT)
steps = [
    ("발주 신청 버튼·알림 뱃지·실시간 시계 추가", "발주 알림을 한눈에 보여주는 뱃지(미읽음 개수)와 대시보드 실시간 날짜/시간/온도 표시를 처음 도입", BLUE, "STEP 1"),
    ("알림 UX 1차 개선", "알림 표시 방식 다듬기 — 사용해보니 부족했던 디테일 보완", BLUE, "STEP 2"),
    ("호버 읽음처리 + X버튼 삭제로 통일", "마우스를 올리면 자동 읽음 처리되어 뱃지가 줄고, 삭제는 실수 방지를 위해 X버튼으로만 가능하도록 변경", BLUE, "STEP 3"),
    ("자기 자신에게 가는 알림 제거", "발주 신청자 본인에게도 알림이 가던 버그 발견 → 본인 제외 필터링", BLUE, "STEP 4"),
    ("알림창 재오픈 버그 수정", "알림창을 닫았다 다시 열면 목록이 사라지는 버그 발견 → 상태 관리 수정", BLUE, "STEP 5"),
]
for i, (t1, t2, c, lbl) in enumerate(steps):
    y = 1.85 + i * 0.98
    step_row(s, y, 0.86, i + 1, t1, t2, c, label=lbl)

# ============================================================
# Slide 6: 딥다이브 ① 알림 UX - 실제 구현
# ============================================================
s = add_slide()
header(s, "DEEP DIVE ①", "알림 UX 반복 개선 — 실제 구현 (Topbar.tsx)", "07", accent=BLUE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "MUI Badge + 로컬 읽음 상태 관리로 구현 — frontend/src/layouts/main-layout/Topbar/Topbar.tsx", size=12.5, bold=True, color=GRAY_TEXT)
rect(s, 0.78, 1.85, 5.70, 4.95, RGBColor(0x1E, 0x1E, 0x1E))
code_lines = [
    "<Badge",
    "  color=\"error\"",
    "  badgeContent={",
    "    notifications",
    "      .filter(n => !n._localRead)",
    "      .length || undefined",
    "  }",
    ">",
    "  <IconButton onClick={handleBellClick}>",
    "    <BellIcon />",
    "  </IconButton>",
    "</Badge>",
    "",
    "// 호버 시 읽음 처리",
    "onMouseEnter={() =>",
    "  handleMarkRead(noti.id)}",
]
ctf_box = s.shapes.add_textbox(Inches(1.00), Inches(2.05), Inches(5.30), Inches(4.55))
ctf = ctf_box.text_frame
ctf.word_wrap = True
first = True
for line in code_lines:
    p = ctf.paragraphs[0] if first else ctf.add_paragraph()
    first = False
    p.line_spacing = 1.25
    r = p.add_run()
    r.text = line if line else " "
    r.font.size = Pt(13)
    r.font.name = "Consolas"
    r.font.color.rgb = RGBColor(0x9C, 0xDC, 0xFE) if not line.strip().startswith("//") else RGBColor(0x6A, 0x99, 0x55)
    if "error" in line or "Badge" in line:
        r.font.color.rgb = RGBColor(0xCE, 0x91, 0x78)

text(s, 6.75, 1.85, 5.80, 5.0, [
    [{"t": "①  ", "size": 13.5, "bold": True, "color": BLUE}, {"t": "빨간 뱃지", "size": 13.5, "bold": True, "color": BLACK_TEXT}],
    [{"t": "MUI color=\"error\" → 테마 색상 #E53935로 렌더링, 미읽음 개수만 카운트", "size": 11.5, "color": GRAY_TEXT}],
    [{"t": "", "size": 6}],
    [{"t": "②  ", "size": 13.5, "bold": True, "color": BLUE}, {"t": "호버 읽음 처리", "size": 13.5, "bold": True, "color": BLACK_TEXT}],
    [{"t": "onMouseEnter로 _localRead 플래그를 true로 변경 → 뱃지 숫자가 즉시 감소", "size": 11.5, "color": GRAY_TEXT}],
    [{"t": "", "size": 6}],
    [{"t": "③  ", "size": 13.5, "bold": True, "color": BLUE}, {"t": "자기 알림 제외", "size": 13.5, "bold": True, "color": BLACK_TEXT}],
    [{"t": "발주 신청자 본인은 알림 대상에서 필터링하도록 백엔드 알림 생성 로직 수정", "size": 11.5, "color": GRAY_TEXT}],
    [{"t": "", "size": 6}],
    [{"t": "검증", "size": 13.5, "bold": True, "color": GREEN}],
    [{"t": "코드 확인 결과 빨간 뱃지·호버 감소 로직 모두 의도대로 동작 — 별도 대화에서 직접 검증함", "size": 11.5, "color": GRAY_TEXT}],
], line_spacing=1.3)

# ============================================================
# Slide 8: 철저한 예외 처리 (NEW)
# ============================================================
s = add_slide()
header(s, "EXCEPTION HANDLING", "철저한 예외 처리 — 사용자가 의도치 않게 만드는 상황들", "08", accent=RGBColor(0xC6, 0x28, 0x28))
simple_text(s, 0.78, 1.30, 11.8, 0.4, "기능을 \"동작하게\" 만드는 것과, 이상한 순서로 써도 \"안 깨지게\" 만드는 것은 다릅니다", size=13, bold=True, color=GRAY_TEXT)
edge_cases = [
    ("발주 신청자 본인에게 알림이 가는 문제", "내가 신청한 발주인데 나에게 \"발주 신청 완료\" 알림이 또 오는 게 무의미하다고 판단 — OrderRequestService에서 알림 생성 호출 자체를 제거", RGBColor(0xC6, 0x28, 0x28)),
    ("30초 폴링과 로컬 읽음 상태의 충돌", "서버는 \"안읽음\" 목록만 내려주는데, 그대로 교체하면 방금 읽은 알림이 다음 폴링에서 사라짐 — \"교체\" 대신 \"신규만 추가\"하는 병합 전략으로 변경", ORANGE),
    ("호버 읽음 vs 실수 삭제 방지", "마우스만 올려도 알림이 사라지면 보고 싶었던 알림을 놓칠 수 있어, 읽음(호버)과 삭제(X버튼)를 명확히 분리", BLUE),
    ("정책 변경의 데이터 정합성 부작용", "이미 발송·수령된 발주까지 취소 가능하게 했더니 재고·배송 기록과 실제 상태가 어긋날 수 있는 경우를 발견 → 영향 커지기 전에 즉시 롤백", PURPLE),
]
for i, (t1, t2, c) in enumerate(edge_cases):
    y = 1.85 + i * 1.27
    step_row(s, y, 1.12, i + 1, t1, t2, c)

# ============================================================
# Slide 9: 딥다이브 ② 발주 취소 정책 실험과 롤백
# ============================================================
s = add_slide()
header(s, "DEEP DIVE ②", "발주 취소 정책 실험 — 빠른 롤백 의사결정", "09", accent=PURPLE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "작은 정책 변경도 전체 데이터 정합성에 영향을 줄 수 있다는 걸 직접 경험한 사례", size=13, bold=True, color=GRAY_TEXT)
exp_steps = [
    ("식자재 발주 각 행에 삭제 아이콘 추가", "발주 목록에서 개별 항목을 더 쉽게 정리할 수 있도록 UI 개선", PURPLE, "1"),
    ("발주 취소/삭제를 모든 상태에서 가능하도록 변경", "이미 발송·수령된 발주까지 취소할 수 있게 정책을 넓힘", ORANGE, "2"),
    ("문제 인지 → 즉시 원복(revert)", "이미 진행된 발주를 취소하면 재고·배송 기록과 실제 상태가 어긋날 수 있다는 리스크를 발견하고, 영향이 더 커지기 전에 바로 되돌림", RGBColor(0xC6, 0x28, 0x28), "3"),
]
for i, (t1, t2, c, lbl) in enumerate(exp_steps):
    y = 1.95 + i * 1.55
    step_row(s, y, 1.35, lbl, t1, t2, c)
text(s, 0.78, 6.65, 11.8, 0.7, [[
    {"t": "배운 점:  ", "size": 12.5, "bold": True, "color": DARKGREEN},
    {"t": "정책성 변경은 \"되는지\"가 아니라 \"되돌릴 수 있는지\"까지 먼저 따져봐야 한다는 걸 체감했습니다.", "size": 12.5, "color": GRAY_TEXT},
]])

# ============================================================
# Slide 8: 딥다이브 ③ 브랜치 통합
# ============================================================
s = add_slide()
header(s, "DEEP DIVE ③", "브랜치 통합", "10", accent=TEAL)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "4명이 각자 다른 브랜치(junho·jihwan·hyeon·jhy)에서 동시에 작업하며 생긴 차이를 정리", size=13, bold=True, color=GRAY_TEXT)
pm_cards = [
    ("브랜치별 작업 분석", "각 브랜치의 고유 커밋을 추적해 누가 무엇을 작업 중인지, jihwan 메인과 어떻게 다른지 정리", TEAL),
    ("문서화", "브랜치별 변경이력 문서를 작성해 팀원 각자의 작업을 한눈에 볼 수 있도록 정리", GREEN),
    ("발표자료 구조 설계", "기능·개발과정·기여도 정보를 어떤 순서로 보여줄지 설계하고 반복적으로 개선", BLUE),
    ("의사결정 조율", "여러 사람의 의견(기여도 비율, 강조할 차별점 등)을 모아 최종 구성을 확정", PURPLE),
]
for i, (t1, t2, c) in enumerate(pm_cards):
    x = 0.78 + (i % 2) * (5.79 + 0.20)
    y = 1.95 + (i // 2) * (2.35 + 0.20)
    card(s, x, y, 5.79, 2.35, t1, t2, c)

# ============================================================
# Slide 9: 사용 기술 스택
# ============================================================
s = add_slide()
header(s, "TECH STACK", "사용 기술 스택", "11", accent=GREEN)
stacks = [
    ("Frontend", "React · TypeScript · MUI — Topbar/MainLayout 컴포넌트 직접 수정", GREEN),
    ("협업 도구", "Git 브랜치 전략, GitHub blame 기반 기여 분석", BLUE),
    ("문서화", "Markdown 변경이력 작성, PPT(python-pptx) 발표자료 설계", ORANGE),
    ("커뮤니케이션", "팀 내 의사결정 조율, 정책 실험 결과 공유", PURPLE),
]
for i, (t1, t2, c) in enumerate(stacks):
    x = 0.78 + (i % 2) * (5.79 + 0.20)
    y = 1.85 + (i // 2) * (2.20 + 0.20)
    card(s, x, y, 5.79, 2.20, t1, t2, c)

# ============================================================
# Slide 10: 마무리
# ============================================================
s = add_slide()
rect(s, 0, 0, 13.333, 7.5, DARKGREEN)
rect(s, 0.90, 1.00, 0.90, 0.16, ORANGE)
simple_text(s, 0.85, 1.20, 11.0, 0.7, "감사합니다", size=40, bold=True, color=WHITE)
simple_text(s, 0.85, 2.20, 11.6, 0.6, "FoodGuard — 지현윤 개인 포트폴리오", size=18, bold=False, color=RGBColor(0xCF, 0xE9, 0xD8))
text(s, 0.85, 3.30, 11.6, 3.2, [
    [{"t": "•  ", "size": 14, "bold": True, "color": ORANGE}, {"t": "아키텍처 이해", "size": 14, "bold": True, "color": WHITE}, {"t": "  — 알림 기능을 DB·API·폴링·로컬 상태까지 전체 흐름으로 설계", "size": 13, "color": RGBColor(0xCF, 0xE9, 0xD8)}],
    [{"t": "•  ", "size": 14, "bold": True, "color": ORANGE}, {"t": "끝까지 파고드는 태도", "size": 14, "bold": True, "color": WHITE}, {"t": "  — 알림 UX를 5단계에 걸쳐 반복 개선", "size": 13, "color": RGBColor(0xCF, 0xE9, 0xD8)}],
    [{"t": "•  ", "size": 14, "bold": True, "color": ORANGE}, {"t": "철저한 예외 처리", "size": 14, "bold": True, "color": WHITE}, {"t": "  — 자기알림·폴링충돌·실수삭제 등 4가지 엣지케이스 직접 발견·수정", "size": 13, "color": RGBColor(0xCF, 0xE9, 0xD8)}],
    [{"t": "•  ", "size": 14, "bold": True, "color": ORANGE}, {"t": "기본을 지키는 태도", "size": 14, "bold": True, "color": WHITE}, {"t": "  — 정책 리스크를 인지하고 빠르게 롤백, 4개 브랜치를 통합·문서화", "size": 13, "color": RGBColor(0xCF, 0xE9, 0xD8)}],
], line_spacing=1.5)

prs.save("FoodGuard_지현윤_개인포트폴리오.pptx")
print("saved")
