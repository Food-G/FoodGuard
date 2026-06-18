# -*- coding: utf-8 -*-
import os
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

FONT = "맑은 고딕"
SHOT_DIR = "캡스톤스크린샷"

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


def header(slide, eyebrow, title, page_num, accent=GREEN):
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


def why_row(slide, y, h, num, title_t, desc_t, accent):
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
    r.font.size = Pt(20)
    r.font.bold = True
    r.font.color.rgb = WHITE
    r.font.name = FONT
    simple_text(slide, 1.95, y + 0.14, 9.85, 0.45, title_t, size=16, bold=True, color=BLACK_TEXT)
    simple_text(slide, 1.95, y + 0.58, 9.85, h - 0.65, desc_t, size=12.5, bold=False, color=GRAY_TEXT)


def add_screenshot(slide, filename, box_x, box_y, box_w, box_h, caption, accent=GREEN):
    path = os.path.join(SHOT_DIR, filename)
    iw, ih = Image.open(path).size
    ratio = iw / ih
    box_ratio = box_w / box_h
    if ratio > box_ratio:
        w = box_w
        h = w / ratio
    else:
        h = box_h
        w = h * ratio
    x = box_x + (box_w - w) / 2
    y = box_y + (box_h - h) / 2
    border = rect(slide, x - 0.04, y - 0.04, w + 0.08, h + 0.08, WHITE)
    border.line.color.rgb = accent
    border.line.width = Pt(1.25)
    slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))
    simple_text(slide, box_x, box_y + box_h + 0.06, box_w, 0.35, caption, size=12, bold=True, color=GRAY_TEXT, align=PP_ALIGN.CENTER)


# ============================================================
# Slide 1: Title
# ============================================================
s = add_slide()
rect(s, 0, 0, 13.333, 7.5, DARKGREEN)
rect(s, -1.0, 4.70, 15.50, 1.50, GREEN)
rect(s, 0.90, 1.05, 0.90, 0.16, ORANGE)
simple_text(s, 0.85, 1.30, 11.0, 0.6, "CAPSTONE DESIGN · 창신대학교 컴퓨터공학과 · 팀 푸드가드(5인)", size=14, bold=True, color=RGBColor(0xBF, 0xE5, 0xCB))
simple_text(s, 0.82, 2.00, 12.0, 1.6, "FoodGuard", size=66, bold=True, color=WHITE)
simple_text(s, 0.85, 3.15, 11.6, 1.0, "AI 수요예측 기반 소상공인 음식점 통합 관리 · 식자재 발주/폐기 절감 + 환경 가치 플랫폼", size=19, bold=False, color=RGBColor(0xDF, 0xF1, 0xE5))
simple_text(s, 0.85, 5.85, 11.6, 0.6, "서준호  ·  김지환  ·  정태현  ·  지현윤  ·  몽흐데르겔", size=18, bold=True, color=WHITE)

# ============================================================
# Slide 2: 프로젝트 개요
# ============================================================
s = add_slide()
header(s, "PROJECT OVERVIEW", "프로젝트 개요", "02")
text(s, 0.78, 1.45, 11.8, 0.9, [[
    {"t": "음식점(소상공인)의 ", "size": 16, "color": BLACK_TEXT},
    {"t": "매출·재고·발주·배달·폐기", "size": 16, "bold": True, "color": GREEN},
    {"t": "를 하나로 묶고, ", "size": 16, "color": BLACK_TEXT},
    {"t": "기상청 데이터와 AI 수요예측", "size": 16, "bold": True, "color": GREEN},
    {"t": "으로 식자재 발주량을 자동 추천하는 풀스택 통합 관리 플랫폼", "size": 16, "color": BLACK_TEXT},
]])
goal_badges = [
    ("목표 ①  가맹점 식자재관리 효율화", GREEN),
    ("목표 ②  환경적 가치 — 폐기물·탄소 절감 (ESG)", TEAL),
]
bw = 5.81
for i, (label, c) in enumerate(goal_badges):
    x = 0.78 + i * (bw + 0.16)
    rrect = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(2.32), Inches(bw), Inches(0.34))
    rrect.fill.solid()
    rrect.fill.fore_color.rgb = c
    rrect.line.fill.background()
    rrect.shadow.inherit = False
    rtf = rrect.text_frame
    rp = rtf.paragraphs[0]
    rp.alignment = PP_ALIGN.CENTER
    rr = rp.add_run()
    rr.text = label
    rr.font.size = Pt(12.5)
    rr.font.bold = True
    rr.font.color.rgb = WHITE
    rr.font.name = FONT
overview_cards = [
    ("POS & 주문/결제", "메뉴 관리 · 테이블 주문 · 결제 확정 흐름", GREEN),
    ("AI 수요예측 발주", "기상청 API + ML 모델로 식자재 발주량 추천", ORANGE),
    ("재고 · 폐기 관리", "레시피 기반 재고 소모 · 폐기 예측 · 긴급도", BLUE),
    ("배달 · 기부", "배달 현황 · 카카오 주소 · 잉여식자재 기부", PURPLE),
]
for i, (t1, t2, c) in enumerate(overview_cards):
    x = 0.78 + i * (2.92 + 0.16)
    card(s, x, 2.70, 2.92, 1.55, t1, t2, c)
simple_text(s, 0.78, 4.70, 6.0, 0.4, "기술 스택 (3-Tier 아키텍처)", size=15, bold=True, color=BLACK_TEXT)
stack_cards = [
    ("Frontend", "React + TypeScript + Vite (MUI)", GREEN),
    ("Backend", "Spring Boot · JPA · JWT 인증 · Gradle", BLUE),
    ("AI Service", "Python FastAPI · ML 수요예측 · 기상청 API", ORANGE),
    ("Database", "TiDB Cloud(MySQL 호환) · schema.sql 기반 RDB", PURPLE),
]
for i, (t1, t2, c) in enumerate(stack_cards):
    x = 0.78 + i * (2.92 + 0.16)
    rect(s, x, 5.20, 2.92, 1.40, WHITE)
    rect(s, x, 5.20, 0.09, 1.40, c)
    simple_text(s, x + 0.22, 5.38, 2.62, 0.4, t1, size=14, bold=True, color=c)
    simple_text(s, x + 0.22, 5.80, 2.54, 0.7, t2, size=11.5, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 3: 제품 둘러보기 - 사용자 여정 (NEW)
# ============================================================
s = add_slide()
header(s, "PRODUCT WALKTHROUGH", "제품 둘러보기 — 가맹점주의 하루", "03", accent=BLUE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "FoodGuard는 가맹점주의 발주 의사결정 흐름을 처음부터 끝까지 따라갑니다", size=13.5, bold=True, color=GRAY_TEXT)
journey = [
    ("로그인 · 홈 확인", "오늘 일정·알림·매장 현황을 한 화면에서 확인", GREEN),
    ("AI 추천 발주", "수요예측 기반 추천 수량으로 발주 신청 (또는 자동 발주)", BLUE),
    ("QR 검수", "본사 발송 → 배달기사 수령 → 점주 수령, 3단계 QR로 확인", ORANGE),
    ("판매 · 재고 반영", "POS로 판매 기록, 레시피 기준 재고 자동 차감", PURPLE),
    ("폐기예측 · 기부", "폐기 위험 식자재를 미리 파악해 잉여분은 기부로 연결", TEAL),
]
n = len(journey)
gap = 0.18
cw = (11.78 - gap * (n - 1)) / n
for i, (t1, t2, c) in enumerate(journey):
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
    rect(s, x, 2.95, cw, 2.85, LIGHT_GRAY_BG)
    rect(s, x, 2.95, cw, 0.08, c)
    simple_text(s, x + 0.12, 3.15, cw - 0.24, 0.7, t1, size=13.5, bold=True, color=BLACK_TEXT)
    simple_text(s, x + 0.12, 3.85, cw - 0.24, 1.85, t2, size=10.5, bold=False, color=GRAY_TEXT)
    if i < n - 1:
        simple_text(s, x + cw - 0.05, 2.06, gap + 0.10, 0.55, "›", size=20, bold=True, color=GRAY_TEXT, align=PP_ALIGN.CENTER)
simple_text(s, 0.78, 6.15, 11.8, 0.9, "이 흐름 전체를 OWNER(가맹점주) 한 명이 별도 도구 전환 없이 FoodGuard 안에서 처리합니다.", size=12.5, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 4: 제품 둘러보기 - 핵심 차별점 (NEW)
# ============================================================
s = add_slide()
header(s, "PRODUCT WALKTHROUGH", "제품 둘러보기 — 핵심 차별점", "04", accent=ORANGE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "단순 재고관리 툴이 아니라, 예측·검증·환경가치까지 연결한 3가지 차별점", size=13.5, bold=True, color=GRAY_TEXT)
diffs = [
    ("날씨 연동 AI 수요예측", "단순 판매이력이 아닌 기상청 데이터를 결합 — 날씨에 따라 크게 흔들리는 식자재 소비를 더 정확히 예측", GREEN),
    ("3단계 QR 책임소재 검증", "본사 발송 → 배달기사 수령 → 점주 수령, 단계마다 QR 검수 — 분실·오배송 발생 시 어느 단계 문제인지 즉시 추적", BLUE),
    ("폐기예측 → 기부로 연결", "예측에서 끝나지 않고 잉여 식자재를 기부로 실제 연결 — 폐기 절감이라는 핵심 가치를 행동으로 구현 (ESG)", TEAL),
]
for i, (t1, t2, c) in enumerate(diffs):
    x = 0.78 + i * (3.79 + 0.20)
    rect(s, x, 1.95, 3.79, 4.55, LIGHT_GRAY_BG)
    rect(s, x, 1.95, 3.79, 0.12, c)
    circ = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + 0.25), Inches(2.30), Inches(0.65), Inches(0.65))
    circ.fill.solid()
    circ.fill.fore_color.rgb = c
    circ.line.fill.background()
    circ.shadow.inherit = False
    ctf = circ.text_frame
    cp = ctf.paragraphs[0]
    cp.alignment = PP_ALIGN.CENTER
    cr = cp.add_run()
    cr.text = str(i + 1)
    cr.font.size = Pt(22)
    cr.font.bold = True
    cr.font.color.rgb = WHITE
    cr.font.name = FONT
    simple_text(s, x + 0.25, 3.15, 3.30, 0.8, t1, size=16, bold=True, color=BLACK_TEXT)
    simple_text(s, x + 0.25, 3.85, 3.30, 2.5, t2, size=12, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 5: 문제 정의
# ============================================================
s = add_slide()
header(s, "PROBLEM DEFINITION", "프로젝트 배경 & 문제 정의", "05", accent=ORANGE)
simple_text(s, 0.78, 1.40, 11.8, 0.5, "외식업 발주는 대부분 점주의 '경험과 감(感)'에 의존합니다", size=16, bold=True, color=BLACK_TEXT)
problems = [
    ("과잉 발주 → 식자재 폐기", "유통기한이 짧은 신선식품이 버려지며 폐기 비용과 음식물 쓰레기가 증가", ORANGE),
    ("재고 부족 → 판매 기회 손실", "품절로 인해 팔 수 있었던 매출을 놓치는 기회손실 발생", BLUE),
    ("데이터 없는 의사결정", "날씨·요일 등 외부 요인이 매출에 미치는 영향을 반영하지 못함", PURPLE),
]
for i, (t1, t2, c) in enumerate(problems):
    x = 0.78 + i * (3.79 + 0.20)
    card(s, x, 2.40, 3.79, 2.6, t1, t2, c)

# ============================================================
# Slide 6: 솔루션 & 기대효과
# ============================================================
s = add_slide()
header(s, "SOLUTION & IMPACT", "솔루션 & 기대 효과", "06", accent=GREEN)
simple_text(s, 0.78, 1.40, 11.8, 0.5, "과거 매출 + 날씨 데이터를 AI로 학습해 메뉴별 수요를 예측하고 발주량을 추천합니다", size=15, bold=True, color=BLACK_TEXT)
pipeline = ["매출·날씨\n데이터 수집", "AI 수요 예측", "발주량 추천", "폐기·품절\n감소"]
pw = 2.55
gap_arrow = 0.45
total_w = pw * 4 + gap_arrow * 3
start_x = (13.333 - total_w) / 2
for i, label in enumerate(pipeline):
    x = start_x + i * (pw + gap_arrow)
    rect(s, x, 2.30, pw, 1.0, GREEN if i % 2 == 0 else BLUE)
    simple_text(s, x, 2.55, pw, 0.6, label.replace("\n", " "), size=13.5, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
    if i < 3:
        simple_text(s, x + pw, 2.55, gap_arrow, 0.5, "›", size=22, bold=True, color=GRAY_TEXT, align=PP_ALIGN.CENTER)
simple_text(s, 0.78, 3.70, 6.0, 0.4, "기대 효과", size=15, bold=True, color=BLACK_TEXT)
effects = [
    ("식자재 폐기율", "15~20% 절감", GREEN),
    ("발주 비용 절감", "& 수익성 향상", BLUE),
    ("품절 방지로", "매출 기회 확보", ORANGE),
    ("음식물 쓰레기 감소", "(ESG · 환경)", PURPLE),
]
for i, (t1, t2, c) in enumerate(effects):
    x = 0.78 + i * (2.92 + 0.16)
    card(s, x, 4.20, 2.92, 1.6, t1, t2, c)

# ============================================================
# Slide 7: 팀 구성 · 담당 역할 (설계 관점으로 재작성)
# ============================================================
s = add_slide()
header(s, "TEAM & SYSTEM DESIGN", "팀 구성 · 담당 역할 (시스템 설계 관점)", "07")
members_roles = [
    ("서", "서준호", "junho", "팀장 · Frontend UI 아키텍처 + POS 도메인", "역할 기반 라우팅 구조를 설계하고, EasyPOS 스타일의 테이블 기반 POS UI를 설계", GREEN),
    ("김", "김지환", "jihwan", "Backend 도메인 설계 + AI 예측 엔진", "JWT 인증 구조와 REST API 설계, RandomForest 기반 수요예측 모델 아키텍처 설계", BLUE),
    ("지", "지현윤", "jhy / jihwan", "시스템 통합 레이어 + 알림 서브시스템", "여러 브랜치의 기능을 통합하는 전략을 수립하고, 이벤트 기반 알림 UX 구조를 설계", ORANGE),
    ("정", "정태현", "hyeon / dev", "데이터 레이어 (DB 스키마 설계)", "AI 예측 도메인을 포함한 ERD를 설계하고, 대시보드용 데이터 구조를 설계", PURPLE),
    ("몽", "몽흐데르겔", "—", "QA / 검증 레이어", "기능별 테스트 시나리오를 설계하고, 사용자 관점의 UX 검증 체계를 수립", TEAL),
]
for i, (letter, name, branch, module, design_point, c) in enumerate(members_roles):
    y = 1.45 + i * 1.135
    h = 1.03
    rect(s, 0.78, y, 11.78, h, LIGHT_GRAY_BG)
    rect(s, 0.78, y, 0.12, h, c)
    oval = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.02), Inches(y + 0.165), Inches(0.70), Inches(0.70))
    oval.fill.solid()
    oval.fill.fore_color.rgb = c
    oval.line.fill.background()
    oval.shadow.inherit = False
    otf = oval.text_frame
    op = otf.paragraphs[0]
    op.alignment = PP_ALIGN.CENTER
    orr = op.add_run()
    orr.text = letter
    orr.font.size = Pt(20)
    orr.font.bold = True
    orr.font.color.rgb = WHITE
    orr.font.name = FONT
    simple_text(s, 1.95, y + 0.30, 2.10, 0.45, name, size=17, bold=True, color=BLACK_TEXT)
    simple_text(s, 4.20, y + 0.10, 3.05, 0.85, module, size=12, bold=True, color=c)
    simple_text(s, 7.40, y + 0.10, 5.00, 0.85, design_point, size=10.5, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 8: 개발 과정 타임라인
# ============================================================
s = add_slide()
header(s, "DEVELOPMENT TIMELINE", "개발 과정 타임라인", "08")
simple_text(s, 0.78, 1.30, 11.8, 0.4, "총 60여 개 커밋 · 2026-04-05 ~ 2026-06-05 (약 2개월) — 위 5명의 역할 분담이 시간순으로 어떻게 전개됐는지", size=13, bold=True, color=GRAY_TEXT)
timeline = [
    ("A", "초기 세팅 · 디자인", "04-05 ~ 04-17", "Spring Boot 골격 + JWT 인증, React/Vite 프론트엔드 프로젝트 구성", GREEN),
    ("B", "협업 체계 · CRUD 완성", "04-24 ~ 05-08", "회원가입 DB 연동, 핵심 도메인 CRUD 완성, FastAPI AI 서비스 신설", BLUE),
    ("C", "AI 예측 · 배달 · POS", "05-15 ~ 05-22", "기상청 연동 수요예측 적용, 카카오 주소 API, POS·배달기사 페이지 구현", ORANGE),
    ("D", "완성도 향상 (최신)", "05-29 ~ 06-05", "예측 모델 보완, QR 3단계 검수 완성, 알림 UX 반복 개선", PURPLE),
]
for i, (letter, title_t, period, desc, c) in enumerate(timeline):
    y = 2.00 + i * 1.30
    rect(s, 0.78, y, 11.78, 1.15, LIGHT_GRAY_BG)
    rect(s, 0.78, y, 0.12, 1.15, c)
    box = rect(s, 1.05, y + 0.22, 0.70, 0.70, c, shape=MSO_SHAPE.OVAL)
    btf = box.text_frame
    bp = btf.paragraphs[0]
    bp.alignment = PP_ALIGN.CENTER
    br = bp.add_run()
    br.text = letter
    br.font.size = Pt(20)
    br.font.bold = True
    br.font.color.rgb = WHITE
    br.font.name = FONT
    simple_text(s, 2.05, y + 0.14, 3.0, 0.4, title_t, size=15, bold=True, color=BLACK_TEXT)
    simple_text(s, 2.05, y + 0.58, 3.0, 0.4, period, size=11, bold=False, color=c)
    simple_text(s, 5.10, y + 0.22, 7.30, 0.75, desc, size=12, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 9: 왜 이렇게 만들었나 ①
# ============================================================
s = add_slide()
header(s, "DESIGN DECISIONS", "왜 이렇게 만들었나 ①", "09")
simple_text(s, 0.78, 1.30, 11.8, 0.4, "위 개발 과정 중 마주친 주요 설계 갈림길과, 그때 이렇게 결정한 이유", size=13, bold=True, color=GRAY_TEXT)
why1 = [
    ("3단계 QR 검수 워크플로우 (본사 → 배달기사 → 점주)",
     "배송 중 분실·오배송이 발생했을 때 어느 단계에서 문제가 생겼는지 책임소재를 명확히 하기 위해 단계별 QR 검수로 설계", GREEN),
    ("AI 수요예측과 폐기예측을 별도 기능으로 분리",
     "폐기 절감이 프로젝트의 핵심 목표이기 때문에, 발주량을 추천하는 수요예측과 기부 대상을 산출하는 폐기예측을 목적에 맞게 분리 설계", BLUE),
    ("잔여 식자재 기부 기능 추가",
     "원래는 프랜차이즈 가맹점 식자재 관리가 목적이었지만, 폐기 절감이라는 핵심 가치를 실제 행동으로 구현하고 환경적 가치도 고려해 남은 식자재를 활용하는 기부 기능을 추가", ORANGE),
]
for i, (t1, t2, c) in enumerate(why1):
    y = 1.95 + i * 1.65
    why_row(s, y, 1.50, i + 1, t1, t2, c)

# ============================================================
# Slide 10: 왜 이렇게 만들었나 ②
# ============================================================
s = add_slide()
header(s, "DESIGN DECISIONS", "왜 이렇게 만들었나 ②", "10")
why2 = [
    ("AI 수요예측에 기상청 날씨 데이터 결합",
     "식자재 소비량이 날씨에 실제로 크게 좌우되기 때문에, 판매 이력만으로는 부족해 날씨 피처를 결합해 예측 정확도를 높임", PURPLE),
    ("서준호의 독자 POS 화면 유지 (jihwan 기능 병합 이후에도)",
     "jihwan 프론트엔드 기능을 병합하면서도, EasyPOS 스타일 UX가 실제 매장 운영에 더 적합하다고 판단해 POS 화면만은 자체 버전을 그대로 유지", GREEN),
    ("OWNER(가맹점주) / HQ_ADMIN(본사) 역할 분리 (RBAC)",
     "실제 프랜차이즈 구조를 반영해 가맹점주와 본사 관리자의 권한과 화면을 명확히 분리하여 설계", BLUE),
]
for i, (t1, t2, c) in enumerate(why2):
    y = 1.95 + i * 1.65
    why_row(s, y, 1.50, i + 1, t1, t2, c)

# ============================================================
# Slide 11: 기능 상세 - Backend
# ============================================================
s = add_slide()
header(s, "FEATURES · BACKEND", "기능 상세 — Backend (Spring Boot)", "11")
backend_cards = [
    ("인증 · 매장 관리", "AuthController·StoreController — JWT 회원가입/로그인, 매장 CRUD", GREEN),
    ("메뉴 · 재고 · 식자재", "MenuController·InventoryController·IngredientController — BOM 기반 CRUD", BLUE),
    ("발주 (3단계 QR검수)", "OrderRequestController — 본사→배달기사→점주 검수, AI 발주 추천", ORANGE),
    ("배달 · 알림", "DeliveryController·NotificationController — WebSocket 배달, 알림 시스템", PURPLE),
    ("잔여 식자재 기부", "DonationController — 기부 요청/완료/취소, 기부 이력 관리", GREEN),
    ("AI 예측 연동", "PredictionController·WastePredictionController — 수요예측 + 폐기예측", BLUE),
]
for i, (t1, t2, c) in enumerate(backend_cards):
    row, col = divmod(i, 3)
    x = 0.78 + col * (3.79 + 0.20)
    y = 1.50 + row * (1.75 + 0.20)
    card(s, x, y, 3.79, 1.75, t1, t2, c)

# ============================================================
# Slide 12: Backend 아키텍처 상세 (NEW)
# ============================================================
s = add_slide()
header(s, "BACKEND ARCHITECTURE", "Backend 아키텍처 상세", "12")
simple_text(s, 0.78, 1.30, 11.8, 0.4, "Spring Boot 3 + JPA 기반 REST API 서버 — 인증부터 외부 API 연동까지", size=13.5, bold=True, color=GRAY_TEXT)
backend_arch_cards = [
    ("보안 (Security)", "JWT Stateless 인증 · BCrypt 비밀번호 해싱 · 공개 엔드포인트 최소화(회원가입/로그인/QR스캔/WebSocket만 예외)", GREEN),
    ("REST API 설계", "13개 도메인별 컨트롤러로 분리 — 인증·매장·메뉴·재고·발주·배달·알림·기부·예측 등 책임 단위로 구성", BLUE),
    ("외부 API 연동", "RestTemplate으로 기상청 API 호출 — 연결 5초 / 읽기 60초 타임아웃 설정으로 외부 장애 격리", ORANGE),
    ("데이터베이스", "TiDB Cloud(MySQL 호환) + JPA/Hibernate — Frontend(5173)·Backend(8080)·AI Service(8000) 3-Tier 분리 통신", PURPLE),
]
for i, (t1, t2, c) in enumerate(backend_arch_cards):
    x = 0.78 + (i % 2) * (5.79 + 0.20)
    y = 1.95 + (i // 2) * (2.35 + 0.20)
    card(s, x, y, 5.79, 2.35, t1, t2, c)

# ============================================================
# Slide 13: AI 수요예측 - 작동 원리 (NEW)
# ============================================================
s = add_slide()
header(s, "AI PREDICTION ENGINE", "AI 수요예측 — 작동 원리", "13", accent=PURPLE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "발주 추천 한 번을 위해 거치는 6단계 파이프라인 (FastAPI + RandomForest)", size=13.5, bold=True, color=GRAY_TEXT)
ai_steps = [
    ("예측 요청", "POST /api/predict/store/{id}"),
    ("날씨 조회", "기상청 단기예보(1~3일)\n+중기예보(4~7일)"),
    ("판매이력 조회", "SALES_DATA에서\n메뉴별 판매 데이터"),
    ("학습데이터 보강", "Open-Meteo로\n과거 날씨 결합"),
    ("모델 학습·예측", "RandomForest로\n7일 수요 예측"),
    ("결과 저장", "PREDICTION_RESULT\n저장 → 발주 추천"),
]
n = len(ai_steps)
gap = 0.16
cw = (11.78 - gap * (n - 1)) / n
for i, (t1, t2) in enumerate(ai_steps):
    x = 0.78 + i * (cw + gap)
    rect(s, x, 2.10, cw, 0.55, PURPLE, shape=MSO_SHAPE.OVAL)
    numtf = s.shapes[-1].text_frame
    nump = numtf.paragraphs[0]
    nump.alignment = PP_ALIGN.CENTER
    numr = nump.add_run()
    numr.text = str(i + 1)
    numr.font.size = Pt(18)
    numr.font.bold = True
    numr.font.color.rgb = WHITE
    numr.font.name = FONT
    rect(s, x, 2.95, cw, 2.85, LIGHT_GRAY_BG)
    rect(s, x, 2.95, cw, 0.08, PURPLE)
    simple_text(s, x + 0.10, 3.15, cw - 0.20, 0.7, t1, size=12.5, bold=True, color=BLACK_TEXT)
    simple_text(s, x + 0.10, 3.85, cw - 0.20, 1.85, t2.replace("\n", " "), size=9.5, bold=False, color=GRAY_TEXT)
    if i < n - 1:
        simple_text(s, x + cw - 0.04, 2.06, gap + 0.08, 0.55, "›", size=18, bold=True, color=GRAY_TEXT, align=PP_ALIGN.CENTER)
simple_text(s, 0.78, 6.15, 11.8, 0.6, "데이터가 7개 미만이면 예측을 시도하지 않고, 부족 안내를 그대로 보여줍니다 (다음 슬라이드 신뢰도 전략 참고).", size=11.5, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 14: AI 수요예측 - 신뢰도 전략 & 날씨 피처 (NEW)
# ============================================================
s = add_slide()
header(s, "AI PREDICTION ENGINE", "AI 수요예측 — 신뢰도 전략 & 날씨 피처", "14", accent=PURPLE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "보유한 판매 데이터 양에 따라 예측 전략을 자동으로 전환하는 적응형 설계", size=13.5, bold=True, color=GRAY_TEXT)

conf_headers = [("보유 데이터", 0.78, 2.60), ("예측 전략", 3.38, 5.60), ("신뢰도", 8.98, 3.58)]
rect(s, 0.78, 1.85, 11.78, 0.48, DARKGREEN)
for label, x, w in conf_headers:
    simple_text(s, x + 0.12, 1.85, w - 0.12, 0.48, label, size=12.5, bold=True, color=WHITE)
conf_rows = [
    ("30개 이상", "RandomForest + 전체 피처 + 날씨", "최대 95% (R²×85%)", PURPLE, WHITE),
    ("7 ~ 29개", "요일 평균 기반 단순 예측", "40% → 31% (decay)", BLUE, LIGHT_GRAY_BG),
    ("7개 미만", "예측 불가 (데이터 부족 안내)", "—", GRAY_TEXT, WHITE),
]
for i, (d, strat, conf, c, bg) in enumerate(conf_rows):
    y = 2.33 + i * 0.56
    rect(s, 0.78, y, 11.78, 0.56, bg)
    rect(s, 0.78, y, 0.07, 0.56, c)
    simple_text(s, 0.90, y, 2.50, 0.56, d, size=13, bold=True, color=c)
    simple_text(s, 3.38, y, 5.60, 0.56, strat, size=12.5, bold=False, color=BLACK_TEXT)
    simple_text(s, 8.98, y, 3.58, 0.56, conf, size=12.5, bold=True, color=c)
simple_text(s, 0.78, 4.15, 11.8, 0.4, "※ 예측일이 멀어질수록 신뢰도는 하루당 1.5%씩 감소 (최소 15%)", size=11.5, bold=False, color=GRAY_TEXT)

simple_text(s, 0.78, 4.85, 6.0, 0.4, "날씨 피처 6종", size=15, bold=True, color=BLACK_TEXT)
weather_feats = ["최고기온 (temp_max)", "최저기온 (temp_min)", "강수량 (precipitation)", "비 오는 날 (is_rainy)", "더운 날 (is_hot)", "추운 날 (is_cold)"]
fx = 0.78
fy = 5.35
for i, feat in enumerate(weather_feats):
    fw = 0.5 + len(feat) * 0.105
    if fx + fw > 12.56:
        fx = 0.78
        fy += 0.55
    rrect = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(fx), Inches(fy), Inches(fw), Inches(0.45))
    rrect.fill.solid()
    rrect.fill.fore_color.rgb = LIGHT_GREEN_BG
    rrect.line.fill.background()
    rrect.shadow.inherit = False
    rtf = rrect.text_frame
    rtf.word_wrap = False
    rp = rtf.paragraphs[0]
    rp.alignment = PP_ALIGN.CENTER
    rr = rp.add_run()
    rr.text = feat
    rr.font.size = Pt(11.5)
    rr.font.bold = True
    rr.font.color.rgb = GREEN
    rr.font.name = FONT
    fx += fw + 0.15
simple_text(s, 0.78, 6.55, 11.8, 0.5, "날씨 + 요일 + 과거 추세(lag·rolling)를 결합해 매출 변동을 학습합니다.", size=11.5, bold=False, color=GRAY_TEXT)

# ============================================================
# Slide 15: 기능 상세 - Frontend
# ============================================================
s = add_slide()
header(s, "FEATURES · FRONTEND", "기능 상세 — Frontend (React)", "15")
frontend_cards = [
    ("대시보드", "Dashboard — 타일형 홈, OWNER/HQ_ADMIN 역할별 진입점", GREEN),
    ("POS · 발주관리", "POS·Orders — 테이블 주문/결제, 발주 현황 QR 검수", BLUE),
    ("재고 · 식자재 · 메뉴", "Inventory·Ingredients·MenuManagement — BOM관리, 재고 긴급도", ORANGE),
    ("AI예측 · 폐기관리", "Predictions·WastePrediction — ECharts 시각화, 폐기예측→기부 연결", PURPLE),
    ("배달 · 기부이력", "DeliveryDriver(Group)·DonationHistory — QR스캔 검수, 기부 이력", GREEN),
    ("본사 관리 (HQ_ADMIN)", "StoreManagement·AdminOrders·Stats — 가맹점 통합관리, 발주승인, 통계", BLUE),
]
for i, (t1, t2, c) in enumerate(frontend_cards):
    row, col = divmod(i, 3)
    x = 0.78 + col * (3.79 + 0.20)
    y = 1.50 + row * (1.75 + 0.20)
    card(s, x, y, 3.79, 1.75, t1, t2, c)

# ============================================================
# Slide 13: 실제 화면 ① 인증
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ① 인증 (로그인 · 회원가입)", "16")
simple_text(s, 0.78, 1.30, 11.8, 0.4, "이메일/비밀번호 로그인과 역할(OWNER/HQ_ADMIN) 선택형 회원가입 화면", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "로그인화면.png", 1.20, 1.85, 5.30, 4.70, "로그인 화면", accent=GREEN)
add_screenshot(s, "회원가입화면.png", 6.85, 1.85, 5.30, 4.70, "회원가입 화면", accent=GREEN)

# ============================================================
# Slide 14: 실제 화면 ② 홈 대시보드 & 실시간 알림
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ② 홈 대시보드 & 실시간 알림", "17")
simple_text(s, 0.78, 1.30, 11.8, 0.4, "타일형 홈 화면(실시간 날짜·온도 포함)과 빨간 뱃지로 표시되는 알림 시스템", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "알림.png", 0.78, 1.85, 11.78, 2.55, "홈 대시보드 — 알림 뱃지(빨간 숫자) 표시", accent=ORANGE)
add_screenshot(s, "알림화면.png", 4.40, 5.10, 4.50, 1.85, "알림 팝오버 — 호버 시 읽음 처리", accent=ORANGE)

# ============================================================
# Slide 15: 실제 화면 ③ POS 주문
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ③ POS · 주문/결제", "18", accent=BLUE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "서준호(junho)가 EasyPOS 스타일로 재설계한 테이블 기반 주문/결제 화면", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "Pos 화면.png", 0.78, 1.85, 11.78, 4.95, "POS 시스템 — 테이블 선택 후 주문 패널", accent=BLUE)

# ============================================================
# Slide 16: 실제 화면 ④ AI 수요예측 & 식자재 발주
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ④ AI 수요예측 & 식자재 발주", "19", accent=PURPLE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "메뉴별 7일 판매량 예측 차트와 AI 예측 기반 자동 발주 화면", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "AI수요예측.png", 0.78, 1.85, 11.78, 2.24, "AI 수요예측 — 메뉴별 7일 판매량 그래프", accent=PURPLE)
add_screenshot(s, "식자재 발주.png", 0.78, 4.65, 11.78, 2.24, "식자재 발주 — 발주 신청 / AI 예측 기반 자동 발주", accent=PURPLE)

# ============================================================
# Slide 17: 실제 화면 ⑤ 메뉴 · 식자재 관리
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ⑤ 메뉴 · 식자재 관리", "20", accent=GREEN)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "메뉴 CRUD 화면과 시스템 전체 식자재 마스터 데이터 관리 화면", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "메뉴관리.png", 1.20, 1.85, 4.60, 4.70, "메뉴 관리 — 등록/삭제", accent=GREEN)
add_screenshot(s, "식자재 관리.png", 6.20, 1.85, 5.95, 4.70, "식자재 관리 — 단위(kg/L/개) 설정", accent=GREEN)

# ============================================================
# Slide 18: 실제 화면 ⑥ 본사 가맹점 관리
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ⑥ 본사 가맹점 관리 (HQ_ADMIN)", "21", accent=BLUE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "전체 가맹점 목록 조회와 가맹점별 상세 정보 · 발주 대기 현황 확인 화면", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "가맹점 네트워크 관리.png", 0.78, 1.85, 11.78, 2.25, "가맹점 네트워크 관리 — 전체 목록", accent=BLUE)
add_screenshot(s, "가맹점 확인.png", 0.78, 4.65, 11.78, 2.25, "가맹점 상세 — 발주 대기 현황", accent=BLUE)

# ============================================================
# Slide 19: 실제 화면 ⑦ 환경 통계 분석
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ⑦ 환경 통계 분석 — ESG 목표 검증", "22", accent=TEAL)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "매출 대비 폐기 비용 추이와 가맹점별 자원 손실 비중, 환경 임팩트를 정량적으로 보여주는 화면", size=13, bold=True, color=GRAY_TEXT)
add_screenshot(s, "환경통계분석.png", 0.78, 1.85, 11.78, 4.95, "환경 통계 분석 — 폐기율 12.5% 감소 = 소나무 124그루 식재 효과", accent=TEAL)

# ============================================================
# Slide 20: 실제 화면 ⑧ hyeon 브랜치 대안 대시보드 (NEW, 정태현)
# ============================================================
s = add_slide()
header(s, "SCREENSHOTS", "실제 화면 ⑧ 대안 대시보드 (hyeon 브랜치, 정태현)", "23", accent=PURPLE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "매출 요약·재고 경고·직원 출퇴근 현황 위젯을 추가한 정태현의 대시보드 재설계 — 아직 jihwan 메인에는 미병합", size=12.5, bold=True, color=GRAY_TEXT)
add_screenshot(s, "정태현홈화면.png", 1.50, 1.80, 10.30, 5.00, "hyeon 대시보드 — 실시간 매출/재고 위젯 + 직원 출퇴근 현황(팀원 5명 표시)", accent=PURPLE)

# ============================================================
# Slides 21-25: 팀원별 기여도 (5인, 실명 + git blame 기반 비율)
# ============================================================
member_detail = [
    ("서준호", "junho", "팀장 · 풀스택 / 프론트 통합 리드", GREEN, "11",
     ["POS", "주문/결제", "메뉴관리", "발주 UI", "프론트 통합"],
     [
         ("초기 UI/UX 기반 구축 (61%)", "사이드바 호버 슬라이드, 검색 기능, 프로필/설정 다이얼로그 — Sidebar.tsx 코드 중 61% 작성"),
         ("POS 시스템 전면 구현·재설계 (100%)", "EasyPOS 스타일 UI, 주문 확정·결제 흐름, 로그인/결제 버그 수정 — POS.tsx 전량 단독 작성"),
         ("메뉴 관리 기능 (69%)", "메뉴 설정 다이얼로그 신규 구현(100%), 메뉴 관리 화면 개편 — MenuManagement.tsx 코드 중 69% 작성"),
         ("발주 UI 개편 (69%)", "발주 현황 화면 개편, QR 검수 흐름 정리 — Orders.tsx 코드 중 69% 작성"),
         ("재고 프론트 보강 (24%)", "재고 긴급도 리스트, 식자재 즉시 등록 기능 추가 — Inventory.tsx 코드 중 24% 보강"),
     ],
     "비율은 해당 기능 파일의 GitHub blame(최신 코드 최종 작성자) 기준 실측", "24"),
    ("김지환", "jihwan", "백엔드 · AI 수요예측 모델", BLUE, "31",
     ["인증", "매출 CRUD", "AI 수요예측", "배달/주소", "admin"],
     [
         ("프로젝트 기반 구축 (100%)", "초기 세팅, ERD 구조 구현, 프론트엔드 폴더 구성 — 초기 기반 커밋 전량 단독 작성"),
         ("회원가입·로그인 · 인증 (67%)", "JWT 인증, DB 저장 회원가입, 매출 CRUD API — AuthController.java 코드 중 67% 작성"),
         ("AI 수요예측 모델 개발 (100%)", "기상청 API 연동, RandomForest 수요예측 모델 — demand_predictor.py 전량 단독 작성"),
         ("배달 시스템 (100%)", "배달 현황 기능, 배달 컨트롤러 API — DeliveryController.java 전량 단독 작성"),
         ("관리자 기능 (100%)", "admin 페이지, 가맹점 통합 관리 — AdminDashboard·StoreManagement 전량 단독 작성"),
     ],
     "비율은 해당 기능 파일의 GitHub blame(최신 코드 최종 작성자) 기준 실측", "25"),
    ("지현윤", "jhy / jihwan", "시스템 통합 · 배포 · PM", ORANGE, "13",
     ["대시보드", "알림 UX", "PM", "정책 실험"],
     [
         ("초기 디자인 구성 (63%)", "백엔드-프론트 연동 전 레이아웃 구성 — MainLayout 코드 중 63% 작성"),
         ("알림 UX 반복 개선 (100%)", "발주 알림뱃지, 호버 읽음처리, 자기알림 제거, 재오픈버그 수정 — 관련 커밋 전부 단독 작성"),
         ("대시보드 매출 시각화 (현재 미반영)", "매출 추이 그래프, 활동 로그(ActivityLog), 인기메뉴 토글 — 이후 다른 안으로 대체되어 현재 코드엔 없음"),
         ("발주 취소 정책 실험 (현재 미반영)", "정책 변경 후 부작용 검토, 즉시 원복(revert) — 실험 후 현재 코드엔 반영되지 않음"),
         ("시스템 통합 · PM (코드 외 영역)", "브랜치 간 기능 정리, 프로젝트 진행 관리 — 코드 통계로 측정되지 않는 영역"),
     ],
     "비율은 해당 기능 파일의 GitHub blame(최신 코드 최종 작성자) 기준 실측", "26"),
    ("정태현", "hyeon / dev", "데이터 처리 · DB 설계", PURPLE, "7",
     ["DB 스키마", "대시보드", "예약 현황", "JWT"],
     [
         ("DB 스키마 설계 (100%)", "AI 수요예측 시스템용 schema.sql 설계 — 전량 단독 작성 (dev 브랜치)"),
         ("대시보드 UI 개편 (84%)", "매출 요약·재고 경고·직원 출퇴근 현황 위젯 추가, 그라데이션 배너 리디자인 — Dashboard.tsx(hyeon) 코드 중 84% 작성"),
         ("예약 현황 페이지 신설 (100%)", "Reservations 페이지 신규 추가, 대시보드 반응형 개선 — 전량 단독 작성"),
         ("매출 통계 페이지 개편 (55%)", "대시보드 3x3 타일 그리드 완성 — SalesStats.tsx 코드 중 55% 작성"),
         ("세션 정책 개선 (hyeon 한정)", "JWT 만료 시간 1시간 → 24시간 연장 — hyeon 브랜치 한정 적용, jihwan 메인엔 미병합"),
     ],
     "비율은 해당 기능 파일의 GitHub blame(최신 코드 최종 작성자) 기준 실측", "27"),
    ("몽흐데르겔", "—", "프론트엔드 보조 · 테스트 / QA", TEAL, "—",
     ["QA", "테스트", "버그 리포트", "UI 피드백"],
     [
         ("기능 테스트 · QA", "주요 화면(POS·발주·예측 등) 기능 테스트 및 버그 리포트"),
         ("UI 사용성 피드백", "실사용 관점에서 화면 흐름·문구에 대한 피드백 제공"),
         ("팀 협업 지원", "프론트엔드 작업 보조 및 팀 내 커뮤니케이션 지원"),
     ],
     "GitHub 커밋 이력은 없어 비율 산정 대상 외 — QA·테스트·협업 기여로 별도 평가", "28"),
]

for name, branch, role, c, commits, tags, contribs, workload, page in member_detail:
    s = add_slide()
    header(s, "MEMBER CONTRIBUTION", f"{name}  —  담당 업무 & 기여 내용", page, accent=c)
    rect(s, 0.78, 1.50, 3.85, 5.45, c)
    simple_text(s, 1.05, 1.72, 3.30, 0.55, name, size=27, bold=True, color=WHITE)
    simple_text(s, 1.05, 2.28, 3.30, 0.45, f"GitHub: {branch}", size=11, bold=False, color=RGBColor(0xE8, 0xF0, 0xEC))
    simple_text(s, 1.05, 2.62, 3.30, 0.45, role, size=12.5, bold=True, color=WHITE)

    text(s, 1.05, 3.50, 3.32, 3.20, [[
        {"t": "핵심 기여 비율은 ", "size": 12, "color": RGBColor(0xE8, 0xF0, 0xEC)},
        {"t": "GitHub blame", "size": 12, "bold": True, "color": WHITE},
        {"t": " (해당 파일의 현재 코드 중 이 사람이 마지막으로 작성한 줄의 비율)을 기준으로 측정했습니다. 공유 파일은 비율이 낮게, 단독 구현 파일은 100%로 나타납니다.", "size": 12, "color": RGBColor(0xE8, 0xF0, 0xEC)},
    ]], line_spacing=1.4)

    simple_text(s, 4.95, 1.50, 7.60, 0.4, "주요 담당 영역", size=14, bold=True, color=c)
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
        rr.font.color.rgb = c
        rr.font.name = FONT
        tx += tw + 0.08

    simple_text(s, 4.95, 2.60, 7.60, 0.4, "핵심 기여 (분담 영역 상세)", size=14, bold=True, color=c)
    body_runs = []
    for title_t, desc_t in contribs:
        body_runs.append([
            {"t": "•  ", "size": 13.5, "bold": True, "color": c},
            {"t": title_t, "size": 13.5, "bold": True, "color": BLACK_TEXT},
            {"t": "  " + desc_t, "size": 12.5, "bold": False, "color": GRAY_TEXT},
        ])
    text(s, 4.95, 3.05, 7.60, 3.90, body_runs, line_spacing=1.3)

# ============================================================
# Slide 25: 정량 기여도 종합
# ============================================================
s = add_slide()
header(s, "CONTRIBUTION ANALYSIS", "정량 기여도 종합", "29")
simple_text(s, 0.78, 1.30, 11.8, 0.4, "전체 기여도(%)는 팀 자체 선언 수치이며, 우측은 참고용 GitHub 코드 통계입니다", size=11.5, bold=False, color=GRAY_TEXT)

declared_rows = [
    ("김지환", "30%", BLUE),
    ("서준호", "20%", GREEN),
    ("정태현", "20%", PURPLE),
    ("지현윤", "20%", ORANGE),
    ("몽흐데르겔", "10%", TEAL),
]
simple_text(s, 0.78, 1.85, 6.0, 0.4, "전체 기여도 (팀 선언)", size=14, bold=True, color=BLACK_TEXT)
bar_max = 3.80
for i, (name, pct, c) in enumerate(declared_rows):
    y = 2.35 + i * 0.62
    simple_text(s, 0.78, y, 1.45, 0.5, name, size=12.5, bold=True, color=c)
    pct_n = int(pct.replace("%", ""))
    bw = bar_max * pct_n / 30
    rect(s, 2.30, y + 0.06, bw, 0.36, c)
    simple_text(s, 2.30 + bw + 0.10, y, 1.0, 0.5, pct, size=12.5, bold=True, color=c)

rect(s, 0.78, 5.60, 6.00, 0.45, LIGHT_GREEN_BG)
simple_text(s, 0.90, 5.60, 5.80, 0.45, "합계  100%  (김지환30 · 서준호20 · 정태현20 · 지현윤20 · 몽흐데르겔10)", size=11, bold=True, color=DARKGREEN)

simple_text(s, 7.15, 1.85, 5.40, 0.4, "참고: GitHub 코드 통계", size=14, bold=True, color=BLACK_TEXT)
git_rows = [
    ("김지환", "30", "+27,683", BLUE, WHITE),
    ("서준호", "13", "+14,553", GREEN, LIGHT_GRAY_BG),
    ("지현윤", "5", "+4,095", ORANGE, WHITE),
    ("정태현", "20", "+7,773", PURPLE, LIGHT_GRAY_BG),
    ("몽흐데르겔", "—", "(QA·테스트)", TEAL, WHITE),
]
rect(s, 7.15, 2.35, 5.40, 0.42, DARKGREEN)
simple_text(s, 7.27, 2.35, 1.3, 0.42, "이름", size=11, bold=True, color=WHITE)
simple_text(s, 8.55, 2.35, 1.0, 0.42, "커밋", size=11, bold=True, color=WHITE)
simple_text(s, 9.55, 2.35, 2.9, 0.42, "추가 코드(+)", size=11, bold=True, color=WHITE)
for i, (name, commits, added, c, bg) in enumerate(git_rows):
    y = 2.77 + i * 0.50
    rect(s, 7.15, y, 5.40, 0.50, bg)
    rect(s, 7.15, y, 0.06, 0.50, c)
    simple_text(s, 7.27, y, 1.3, 0.50, name, size=11, bold=True, color=c)
    simple_text(s, 8.55, y, 1.0, 0.50, commits, size=11, bold=False, color=BLACK_TEXT)
    simple_text(s, 9.55, y, 2.9, 0.50, added, size=11, bold=False, color=GRAY_TEXT)

text(s, 7.15, 5.50, 5.40, 1.30, [
    [{"t": "※ ", "size": 10, "bold": True, "color": GRAY_TEXT},
     {"t": "동일 인물의 여러 Git 계정명을 통합 집계한 코드 작성량 기준 수치이며, PM·QA·기획·문서화 등", "size": 10, "bold": False, "color": GRAY_TEXT}],
    [{"t": "비-코드 기여는 반영되어 있지 않습니다. 전체 기여도(%)는 이를 포함한 팀 합의 수치입니다.", "size": 10, "bold": False, "color": GRAY_TEXT}],
], line_spacing=1.25)

# ============================================================
# Slide 26: 향후 진행방향
# ============================================================
s = add_slide()
header(s, "NEXT STEPS", "향후 진행 방향", "30", accent=BLUE)
simple_text(s, 0.78, 1.30, 11.8, 0.4, "MVP 핵심 기능은 구현 완료 — 통합 마무리와 정확도 고도화에 집중합니다", size=13.5, bold=True, color=GRAY_TEXT)
next_steps = [
    ("잔여 브랜치 기능 최종 통합", "junho(독자 POS)·hyeon(예약 현황) 등 미병합 기능을 정리해 단일 버전으로 통합", GREEN),
    ("AI 모델 정확도 추가 튜닝", "날씨·외부요인 가중치 조정으로 예측 오차 개선", ORANGE),
    ("CI/CD 자동 배포 파이프라인", "GitHub Actions 기반 자동 테스트·배포 구축", BLUE),
    ("발주 취소/삭제 정책 재논의", "실험 후 보류된 정책을 팀 논의를 거쳐 최종 확정", PURPLE),
    ("실사용 시나리오 기반 통합 QA", "가맹점 운영 시나리오로 통합 테스트 및 피드백 반영", TEAL),
    ("최종 시연 & 발표자료 마무리", "결과 보고서 작성 및 성능 검증 결과 정리", GREEN),
]
for i, (t1, t2, c) in enumerate(next_steps):
    row, col = divmod(i, 3)
    x = 0.78 + col * (3.79 + 0.20)
    y = 2.00 + row * (1.95 + 0.20)
    card(s, x, y, 3.79, 1.95, t1, t2, c)

# ============================================================
# Slide 27: 협업 구조 & 결론
# ============================================================
s = add_slide()
rect(s, 0, 0, 13.333, 7.5, DARKGREEN)
rect(s, 0.90, 0.70, 0.90, 0.16, ORANGE)
simple_text(s, 0.85, 0.90, 11.0, 0.7, "협업 구조 & 결론", size=28, bold=True, color=WHITE)
simple_text(s, 0.85, 1.70, 11.6, 0.5, "5인 5색 역할 분담으로 완성한 AI 통합 음식점 관리 플랫폼", size=15, bold=False, color=RGBColor(0xCF, 0xE9, 0xD8))
conclusion_members = [
    ("김지환", "설계·인증·AI 코어", "30%", BLUE),
    ("서준호", "POS·주문·UI 통합", "20%", GREEN),
    ("정태현", "DB·대시보드", "20%", PURPLE),
    ("지현윤", "통합·PM·알림UX", "20%", ORANGE),
    ("몽흐데르겔", "테스트·QA", "10%", TEAL),
]
card_w = 2.28
gap = 0.12
total_w = card_w * 5 + gap * 4
start_x = (13.333 - total_w) / 2
for i, (name, role, pct, c) in enumerate(conclusion_members):
    x = start_x + i * (card_w + gap)
    rect(s, x, 2.55, card_w, 1.55, WHITE)
    rect(s, x, 2.55, card_w, 0.12, c)
    simple_text(s, x, 2.85, card_w, 0.45, name, size=15.5, bold=True, color=c, align=PP_ALIGN.CENTER)
    simple_text(s, x + 0.08, 3.28, card_w - 0.16, 0.55, role, size=10.5, bold=False, color=GRAY_TEXT, align=PP_ALIGN.CENTER)
    simple_text(s, x, 3.80, card_w, 0.35, pct, size=14, bold=True, color=c, align=PP_ALIGN.CENTER)

simple_text(s, 0.85, 4.55, 11.70, 0.5, "프로젝트 결론", size=15, bold=True, color=ORANGE)
text(s, 0.85, 5.00, 11.70, 2.0, [
    [{"t": "•  ", "size": 13.5, "bold": True, "color": ORANGE},
     {"t": "Spring Boot · React · Python(FastAPI ML) 3-Tier 풀스택으로 매출·재고·발주·배달·폐기를 통합", "size": 13.5, "color": WHITE}],
    [{"t": "•  ", "size": 13.5, "bold": True, "color": ORANGE},
     {"t": "기상청 데이터 + AI 수요예측으로 식자재 발주를 자동 추천해 폐기율 15~20% 절감을 목표", "size": 13.5, "color": WHITE}],
    [{"t": "•  ", "size": 13.5, "bold": True, "color": ORANGE},
     {"t": "3단계 QR 검수로 배송 책임소재를 명확히 하고, 실사용 피드백을 반영해 알림 UX를 지속 개선", "size": 13.5, "color": WHITE}],
    [{"t": "•  ", "size": 13.5, "bold": True, "color": ORANGE},
     {"t": "5명이 설계·인증·AI·POS·DB·시각화·QA 영역을 명확히 분담하고 브랜치 병합으로 통합 완성", "size": 13.5, "color": WHITE}],
], line_spacing=1.3)
simple_text(s, 0.85, 7.05, 11.6, 0.4, "데이터로 줄이는 낭비, 점주와 함께 성장하는 FoodGuard", size=12.5, bold=False, color=RGBColor(0x9F, 0xC9, 0xAD))

prs.save("FoodGuard_포트폴리오.pptx")
print("saved")
