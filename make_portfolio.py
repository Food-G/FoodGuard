# -*- coding: utf-8 -*-
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION

# ---------- Theme ----------
GREEN      = RGBColor(0x1E, 0x8E, 0x3E)   # primary
GREEN_DK   = RGBColor(0x14, 0x5A, 0x28)
GREEN_LT   = RGBColor(0xE6, 0xF4, 0xEA)
INK        = RGBColor(0x20, 0x2124)  if False else RGBColor(0x21, 0x25, 0x29)
GRAY       = RGBColor(0x5F, 0x6B, 0x7A)
LGRAY      = RGBColor(0xF4, 0xF6, 0xF8)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
ACCENT     = RGBColor(0xF5, 0x9E, 0x0B)   # amber
BLUE       = RGBColor(0x1A, 0x73, 0xE8)
PURPLE     = RGBColor(0x7B, 0x3F, 0xE4)

FONT = "맑은 고딕"

prs = Presentation()
prs.slide_width  = Inches(13.333)
prs.slide_height = Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]

def slide():
    return prs.slides.add_slide(BLANK)

def rect(s, x, y, w, h, fill, line=None, shape=MSO_SHAPE.RECTANGLE):
    sp = s.shapes.add_shape(shape, x, y, w, h)
    sp.fill.solid(); sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line; sp.line.width = Pt(1)
    sp.shadow.inherit = False
    return sp

def txt(s, x, y, w, h, runs, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=1.0, wrap=True):
    """runs: list of paragraphs; each paragraph is list of (text, size, bold, color, italic)"""
    tb = s.shapes.add_textbox(x, y, w, h); tf = tb.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Pt(2); tf.margin_top = tf.margin_bottom = Pt(2)
    for i, para in enumerate(runs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align; p.line_spacing = spacing
        if isinstance(para, tuple): para = [para]
        for (t, sz, b, c, *rest) in para:
            r = p.add_run(); r.text = t
            r.font.size = Pt(sz); r.font.bold = b; r.font.color.rgb = c
            r.font.name = FONT
            if rest and rest[0]: r.font.italic = True
    return tb

def bullet(s, x, y, w, h, items, size=15, gap=1.18, color=INK, mark="•", mark_color=GREEN):
    tb = s.shapes.add_textbox(x, y, w, h); tf = tb.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = Pt(2)
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = gap; p.space_after = Pt(3)
        if isinstance(it, tuple):
            head, body = it
            r = p.add_run(); r.text = mark + "  "; r.font.size = Pt(size); r.font.bold = True
            r.font.color.rgb = mark_color; r.font.name = FONT
            r = p.add_run(); r.text = head; r.font.size = Pt(size); r.font.bold = True
            r.font.color.rgb = color; r.font.name = FONT
            if body:
                r = p.add_run(); r.text = "  " + body; r.font.size = Pt(size-1); r.font.bold = False
                r.font.color.rgb = GRAY; r.font.name = FONT
        else:
            r = p.add_run(); r.text = mark + "  "; r.font.size = Pt(size); r.font.bold = True
            r.font.color.rgb = mark_color; r.font.name = FONT
            r = p.add_run(); r.text = it; r.font.size = Pt(size); r.font.color.rgb = color
            r.font.name = FONT
    return tb

def header(s, kicker, title, num):
    rect(s, 0, 0, SW, Inches(1.15), WHITE)
    rect(s, Inches(0.5), Inches(0.34), Inches(0.14), Inches(0.5), GREEN)
    txt(s, Inches(0.78), Inches(0.22), Inches(10), Inches(0.4),
        [[(kicker, 12, True, GREEN)]])
    txt(s, Inches(0.78), Inches(0.5), Inches(11), Inches(0.6),
        [[(title, 26, True, INK)]])
    txt(s, Inches(12.2), Inches(0.4), Inches(0.9), Inches(0.5),
        [[(num, 13, True, RGBColor(0xC0,0xC8,0xD0))]], align=PP_ALIGN.RIGHT)
    rect(s, 0, Inches(1.15), SW, Pt(2.2), GREEN)

# ============================================================
# Slide 1 — Title
# ============================================================
s = slide()
rect(s, 0, 0, SW, SH, GREEN_DK)
rect(s, 0, 0, SW, SH, GREEN_DK)
# diagonal accent band
band = rect(s, Inches(-1), Inches(4.7), Inches(15.5), Inches(1.5), GREEN)
band.rotation = -6
rect(s, Inches(0.9), Inches(1.05), Inches(0.9), Inches(0.16), ACCENT)
txt(s, Inches(0.85), Inches(1.3), Inches(11), Inches(0.6),
    [[("CAPSTONE DESIGN · 컴퓨터공학과 1조", 14, True, RGBColor(0xBF,0xE5,0xCB))]])
txt(s, Inches(0.82), Inches(2.0), Inches(12), Inches(1.6),
    [[("FoodGuard", 66, True, WHITE)]])
txt(s, Inches(0.85), Inches(3.15), Inches(11.6), Inches(1.0),
    [[("AI 수요예측 기반 소상공인 음식점 통합 관리 · 식자재 발주/폐기 절감 플랫폼", 19, False, RGBColor(0xDF,0xF1,0xE5))]])
txt(s, Inches(0.85), Inches(5.55), Inches(11.6), Inches(1.2),
    [[("팀 기여도 분석 & 최종 포트폴리오", 17, True, WHITE)],
     [("Team  ·  junho  ·  jihwan  ·  jhy  ·  hyeon", 13, False, RGBColor(0xCF,0xE9,0xD8))],
     [("2026.06  ·  Git 브랜치 커밋 이력 기반 분석", 11, False, RGBColor(0x9F,0xC9,0xAD))]])

# ============================================================
# Slide 2 — 프로젝트 개요
# ============================================================
s = slide()
header(s, "PROJECT OVERVIEW", "프로젝트 개요", "02")
txt(s, Inches(0.78), Inches(1.45), Inches(11.8), Inches(0.9),
    [[("음식점(소상공인)의 ", 16, False, INK), ("매출·재고·발주·배달·폐기", 16, True, GREEN),
      ("를 하나로 묶고, ", 16, False, INK),
      ("기상청 데이터와 AI 수요예측", 16, True, GREEN),
      ("으로 식자재 발주량을 자동 추천하는 풀스택 통합 관리 플랫폼", 16, False, INK)]], spacing=1.25)

cards = [
    ("POS & 주문/결제", "메뉴 관리 · 테이블 주문 · 결제 확정 흐름", GREEN),
    ("AI 수요예측 발주", "기상청 API + ML 모델로 식자재 발주량 추천", ACCENT),
    ("재고 · 폐기 관리", "레시피 기반 재고 소모 · 폐기 예측 · 긴급도", BLUE),
    ("배달 · 기부", "배달 현황 · 카카오 주소 · 잉여식자재 기부", PURPLE),
]
cx = Inches(0.78); cw = Inches(2.92); gap = Inches(0.12); cy = Inches(2.7); ch = Inches(1.55)
for i,(t,d,col) in enumerate(cards):
    x = cx + (cw+gap)*i
    rect(s, x, cy, cw, ch, LGRAY)
    rect(s, x, cy, cw, Inches(0.1), col)
    txt(s, x+Inches(0.18), cy+Inches(0.28), cw-Inches(0.36), Inches(0.6), [[(t,14.5,True,INK)]])
    txt(s, x+Inches(0.18), cy+Inches(0.74), cw-Inches(0.36), Inches(0.7), [[(d,11.5,False,GRAY)]], spacing=1.1)

# tech stack
ty = Inches(4.7)
txt(s, Inches(0.78), ty, Inches(6), Inches(0.4), [[("기술 스택 (3-Tier 아키텍처)", 15, True, INK)]])
stacks = [
    ("Frontend", "React + TypeScript + Vite (MUI)", GREEN),
    ("Backend", "Spring Boot · JPA · JWT 인증 · Gradle", BLUE),
    ("AI Service", "Python FastAPI · ML 수요예측 · 기상청 API", ACCENT),
    ("Database", "schema.sql 기반 RDB · 매출/재고/예측 도메인", PURPLE),
]
sy = Inches(5.2)
for i,(t,d,col) in enumerate(stacks):
    x = cx + (cw+gap)*i
    rect(s, x, sy, cw, Inches(1.4), WHITE, line=RGBColor(0xE0,0xE5,0xEA))
    rect(s, x, sy, Inches(0.09), Inches(1.4), col)
    txt(s, x+Inches(0.22), sy+Inches(0.18), cw-Inches(0.3), Inches(0.4), [[(t,14,True,col)]])
    txt(s, x+Inches(0.22), sy+Inches(0.6), cw-Inches(0.38), Inches(0.7), [[(d,11.5,False,GRAY)]], spacing=1.12)

# ============================================================
# Slide 3 — 팀 구성 & 역할 한눈에
# ============================================================
s = slide()
header(s, "TEAM & ROLES", "팀 구성 · 담당 역할 요약", "03")
team = [
    ("junho",  "POS · 주문/결제 · UI 통합", "풀스택 / 프론트 통합 리드", GREEN,
     "POS 시스템, 메뉴·발주 UI, 프론트엔드 병합/반응형"),
    ("jihwan", "인증 · 매출 · AI예측 · 배달", "프로젝트 리드 / 풀스택", BLUE,
     "회원가입·로그인, 매출 CRUD, AI 수요예측 모델, 배달/주소 API"),
    ("jhy",    "대시보드 · 데이터 시각화", "프론트엔드 / 분석", ACCENT,
     "대시보드 UI, 매출 추이 그래프, 활동 로그, 인기메뉴 분석"),
    ("hyeon",  "DB 스키마 · 백엔드 인프라", "백엔드 / 시스템 통합", PURPLE,
     "DB 스키마·엔티티 설계, CORS·SPA 라우팅, 프론트-백 연동 안정화"),
]
ry = Inches(1.5); rh = Inches(1.32); rgap = Inches(0.12)
for i,(name,role,tag,col,desc) in enumerate(team):
    y = ry + (rh+rgap)*i
    rect(s, Inches(0.78), y, Inches(11.78), rh, LGRAY)
    rect(s, Inches(0.78), y, Inches(0.12), rh, col)
    # avatar circle
    av = rect(s, Inches(1.1), y+Inches(0.27), Inches(0.78), Inches(0.78), col, shape=MSO_SHAPE.OVAL)
    txt(s, Inches(1.1), y+Inches(0.27), Inches(0.78), Inches(0.78), [[(name[0].upper(),24,True,WHITE)]],
        align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    txt(s, Inches(2.1), y+Inches(0.2), Inches(2.4), Inches(0.5), [[(name,19,True,INK)]])
    txt(s, Inches(2.1), y+Inches(0.72), Inches(2.6), Inches(0.4), [[(tag,11.5,True,col)]])
    txt(s, Inches(4.9), y+Inches(0.24), Inches(3.1), Inches(0.9),
        [[(role,14,True,INK)]], anchor=MSO_ANCHOR.MIDDLE, spacing=1.1)
    txt(s, Inches(8.1), y+Inches(0.24), Inches(4.3), Inches(0.9),
        [[(desc,11.5,False,GRAY)]], anchor=MSO_ANCHOR.MIDDLE, spacing=1.15)

# ============================================================
# Detail slide builder
# ============================================================
def detail(name, color, branch, commits, plus, minus, role_line, areas, contribs, files_note):
    s = slide()
    header(s, "MEMBER CONTRIBUTION", f"{name}  —  담당 업무 & 기여 내용", "")
    # left panel
    rect(s, Inches(0.78), Inches(1.5), Inches(3.85), Inches(5.45), color)
    txt(s, Inches(1.05), Inches(1.8), Inches(3.3), Inches(0.6), [[(name,30,True,WHITE)]])
    txt(s, Inches(1.05), Inches(2.45), Inches(3.3), Inches(0.5), [[(role_line,13,True,RGBColor(0xFF,0xFF,0xFF))]],
        spacing=1.1)
    txt(s, Inches(1.05), Inches(3.2), Inches(3.3), Inches(0.3), [[("브랜치", 11, True, RGBColor(0xE8,0xF0,0xEC))]])
    txt(s, Inches(1.05), Inches(3.46), Inches(3.3), Inches(0.4), [[(branch, 15, True, WHITE)]])
    # stat boxes
    stats = [("커밋 수", f"{commits}", "commits"),
             ("추가 코드", f"+{plus:,}", "lines"),
             ("삭제/수정", f"-{minus:,}", "lines")]
    sy = Inches(4.05)
    for i,(lab,val,unit) in enumerate(stats):
        yy = sy + Inches(0.92)*i
        rect(s, Inches(1.05), yy, Inches(3.32), Inches(0.78), RGBColor(0xFF,0xFF,0xFF))
        txt(s, Inches(1.22), yy+Inches(0.1), Inches(1.7), Inches(0.6), [[(lab,11.5,True,GRAY)]],
            anchor=MSO_ANCHOR.MIDDLE)
        txt(s, Inches(2.7), yy+Inches(0.08), Inches(1.6), Inches(0.62),
            [[(val,21,True,color)]], align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
    # right side
    rx = Inches(4.95)
    txt(s, rx, Inches(1.5), Inches(7.6), Inches(0.4), [[("주요 담당 영역", 14, True, color)]])
    # area chips
    chx = rx
    for a in areas:
        w = Inches(0.34 + 0.105*len(a))
        chip = rect(s, chx, Inches(1.92), w, Inches(0.42), GREEN_LT if color==GREEN else LGRAY,
                    shape=MSO_SHAPE.ROUNDED_RECTANGLE)
        txt(s, chx, Inches(1.92), w, Inches(0.42), [[(a,11.5,True,color)]],
            align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        chx = chx + w + Inches(0.12)
    txt(s, rx, Inches(2.6), Inches(7.6), Inches(0.4), [[("핵심 기여 (커밋 이력 기반)", 14, True, color)]])
    bullet(s, rx, Inches(3.05), Inches(7.6), Inches(3.4), contribs, size=13.5, gap=1.18, mark_color=color)
    rect(s, rx, Inches(6.55), Inches(7.55), Inches(0.5), LGRAY)
    txt(s, rx+Inches(0.18), Inches(6.55), Inches(7.2), Inches(0.5),
        [[("작업 비중:  ", 11.5, True, INK), (files_note, 11.5, False, GRAY)]],
        anchor=MSO_ANCHOR.MIDDLE)
    return s

# ---- junho ----
detail("junho", GREEN, "junho", 13, 14553, 13247,
       "풀스택 · 프론트 통합 리드",
       ["POS", "주문/결제", "메뉴관리", "발주 UI", "프론트 통합"],
       [
        ("POS 시스템 전면 구현·재설계", "EasyPOS 스타일 UI, 주문 확정·결제 흐름, 로그인/결제 버그 수정"),
        ("메뉴 관리 기능", "메뉴 설정 다이얼로그, 메뉴/메인 화면 UI 개편"),
        ("재고·발주 프론트", "재고 긴급도 리스트, 식자재 즉시 등록, 레시피 기반 재고 소모 + AI 발주 UI"),
        ("매출 표기 개선", "매출 원화 축약 표기, 반응형 레이아웃 적용"),
        ("프론트엔드 통합 관리", "jihwan 스타일/기능 병합, CORS 오류 및 페이지 로딩 버그 수정"),
       ],
       "backend/src 130개 · frontend/src 116개 파일 (POS·주문 풀스택)")

# ---- jihwan ----
detail("jihwan", BLUE, "jihwan", 30, 27683, 6069,
       "프로젝트 리드 · 풀스택",
       ["인증", "매출 CRUD", "AI 수요예측", "배달/주소", "admin"],
       [
        ("프로젝트 기반 구축", "초기 세팅, ERD 구조 구현, 프론트엔드 폴더 구성 (최다 커밋·라인)"),
        ("회원가입·로그인 · 인증", "JWT 인증, DB 저장 회원가입, JMT 인증 및 매출 CRUD API"),
        ("AI 수요예측 모델 개발", "기상청 API 키 발급·연동, 수요예측 ML 모델, AI 예측 기반 발주"),
        ("배달 시스템", "배달 현황 기능, 카카오 주소 API 연동, 배달 기사 웹 페이지"),
        ("관리자 기능", "admin 페이지, 타일 홈 구성, QR 코드 적용"),
       ],
       "frontend 172 · backend 159 · ai-service(ml/services) 파일 (전 영역 최다 기여)")

# ---- jhy ----
detail("jhy", ACCENT, "jhy", 5, 4095, 1142,
       "프론트엔드 · 데이터 시각화",
       ["대시보드", "매출 분석", "차트", "활동로그"],
       [
        ("백엔드-프론트 연동 디자인", "연동 전 화면 디자인·레이아웃 구성"),
        ("대시보드 UI 전면 개선", "대시보드 레이아웃 리팩토링, 카드·차트 구조 정리"),
        ("매출 추이 그래프", "매출 추이 그래프 추가 및 판매량 → 매출액 지표로 개선"),
        ("활동 로그 · 인기 분석", "ActivityLog 컴포넌트 추가, 인기 메뉴 기간 토글 기능"),
       ],
       "frontend/src 94개 파일 (대시보드·시각화 집중)")

# ---- hyeon ----
detail("hyeon", PURPLE, "hyeon / HYEON", 20, 7773, 2468,
       "백엔드 · 시스템 통합",
       ["DB 스키마", "엔티티", "CORS/라우팅", "연동 안정화"],
       [
        ("DB 스키마 설계", "AI 수요예측 시스템용 schema.sql 설계, schema 기준 엔티티 전면 정렬"),
        ("백엔드 도메인 보강", "PredictionResult·OrderItem 레이어 등 누락 클래스 추가, 정합성 수정"),
        ("프론트-백엔드 연동 안정화", "필드/URL 불일치 전면 수정, CORS 포트 허용, 헬스체크 엔드포인트"),
        ("서빙/배포 통합", "8080 통합 서빙 + SPA 라우팅(WebConfig), DB 스키마 자동 초기화"),
        ("AI 예측 통합", "JHY AI예측 수정 반영, 식자재 발주 페이지에 AI 수요예측 기능 통합"),
       ],
       "backend/src 112 · frontend/src 64개 파일 (백엔드·인프라 중심)")

# ============================================================
# Slide — 정량 기여도 종합 (차트)
# ============================================================
s = slide()
header(s, "CONTRIBUTION ANALYSIS", "정량 기여도 종합", "08")

# table
names = ["junho", "jihwan", "jhy", "hyeon"]
cols  = [GREEN, BLUE, ACCENT, PURPLE]
commits = [13, 30, 5, 20]
plus = [14553, 27683, 4095, 7773]
minus = [13247, 6069, 1142, 2468]
roles = ["POS·주문·UI 통합", "인증·매출·AI예측·배달", "대시보드·시각화", "DB스키마·백엔드 통합"]

tx = Inches(0.78); ty = Inches(1.5); tw = Inches(6.0)
heads = ["이름", "커밋", "추가(+)", "역할"]
hw = [Inches(1.15), Inches(0.95), Inches(1.25), Inches(2.65)]
# header row
xx = tx
rect(s, tx, ty, tw, Inches(0.5), GREEN_DK)
for h,w in zip(heads,hw):
    txt(s, xx+Inches(0.1), ty, w, Inches(0.5), [[(h,12.5,True,WHITE)]], anchor=MSO_ANCHOR.MIDDLE)
    xx += w
for i,name in enumerate(names):
    ry = ty + Inches(0.5) + Inches(0.62)*i
    rect(s, tx, ry, tw, Inches(0.62), WHITE if i%2==0 else LGRAY)
    rect(s, tx, ry, Inches(0.08), Inches(0.62), cols[i])
    xx = tx
    vals = [name, str(commits[i]), f"+{plus[i]:,}", roles[i]]
    bolds = [True, False, False, False]
    colr = [cols[i], INK, GREEN, GRAY]
    szs = [13.5, 12.5, 12.5, 11.5]
    for v,w,bo,cr,sz in zip(vals,hw,bolds,colr,szs):
        txt(s, xx+Inches(0.12), ry, w, Inches(0.62), [[(v,sz,bo,cr)]], anchor=MSO_ANCHOR.MIDDLE)
        xx += w
# total row
ry = ty + Inches(0.5) + Inches(0.62)*4
rect(s, tx, ry, tw, Inches(0.5), GREEN_LT)
txt(s, tx+Inches(0.12), ry, Inches(1.15), Inches(0.5), [[("합계",12.5,True,GREEN_DK)]], anchor=MSO_ANCHOR.MIDDLE)
txt(s, tx+Inches(1.15)+Inches(0.12), ry, Inches(0.95), Inches(0.5), [[(str(sum(commits)),12.5,True,GREEN_DK)]], anchor=MSO_ANCHOR.MIDDLE)
txt(s, tx+Inches(2.1)+Inches(0.12), ry, Inches(1.25), Inches(0.5), [[(f"+{sum(plus):,}",12.5,True,GREEN_DK)]], anchor=MSO_ANCHOR.MIDDLE)

txt(s, tx, ry+Inches(0.75), tw, Inches(0.9),
    [[("※ ", 10.5, True, GRAY), ("동일 인물의 여러 계정명(JiHwan·rlawlghks0619 등)을 통합 집계, "
      "node_modules·빌드·이미지 등 자동생성 파일은 제외한 순수 코드 라인 기준", 10.5, False, GRAY)]],
    spacing=1.2)

# chart - commits by member (doughnut)
chart_data = CategoryChartData()
chart_data.categories = names
chart_data.add_series('커밋 수', commits)
gx = Inches(7.15); gy = Inches(1.55); gw = Inches(5.4); gh = Inches(4.0)
gframe = s.shapes.add_chart(XL_CHART_TYPE.DOUGHNUT, gx, gy, gw, gh, chart_data)
chart = gframe.chart
chart.has_legend = True
chart.legend.position = XL_LEGEND_POSITION.RIGHT
chart.legend.include_in_layout = False
chart.legend.font.size = Pt(12); chart.legend.font.name = FONT
chart.has_title = True
chart.chart_title.text_frame.text = "커밋 수 비중"
chart.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(13)
chart.chart_title.text_frame.paragraphs[0].runs[0].font.name = FONT
chart.chart_title.text_frame.paragraphs[0].runs[0].font.bold = True
plot = chart.plots[0]
plot.has_data_labels = True
plot.data_labels.show_percentage = True
plot.data_labels.show_value = False
plot.data_labels.number_format = '0%'
plot.data_labels.number_format_is_linked = False
plot.data_labels.font.size = Pt(11); plot.data_labels.font.bold = True
plot.data_labels.font.color.rgb = WHITE; plot.data_labels.font.name = FONT
for idx, pt in enumerate(plot.series[0].points):
    pt.format.fill.solid(); pt.format.fill.fore_color.rgb = cols[idx]

txt(s, gx, gy+gh+Inches(0.15), gw, Inches(1.0),
    [[("기여 요약", 13, True, INK)],
     [("jihwan(30) 이 설계·인증·AI 전반을 주도, hyeon(20) 이 백엔드/인프라, "
       "junho(13) 가 POS·UI 통합, jhy(5) 가 대시보드 시각화를 담당", 11.5, False, GRAY)]],
    spacing=1.2)

# ============================================================
# Slide — 마무리 / 협업 구조
# ============================================================
s = slide()
rect(s, 0, 0, SW, SH, GREEN_DK)
rect(s, Inches(0.9), Inches(0.85), Inches(0.9), Inches(0.16), ACCENT)
txt(s, Inches(0.85), Inches(1.05), Inches(11), Inches(0.7), [[("협업 구조 & 결론", 30, True, WHITE)]])
txt(s, Inches(0.85), Inches(1.95), Inches(11.6), Inches(0.6),
    [[("4인 4색 역할 분담으로 완성한 AI 통합 음식점 관리 플랫폼", 16, False, RGBColor(0xCF,0xE9,0xD8))]])

flow = [
    ("jihwan", "설계·인증·AI 코어", BLUE),
    ("hyeon", "DB·백엔드 인프라", PURPLE),
    ("junho", "POS·주문·UI 통합", GREEN),
    ("jhy", "대시보드·시각화", ACCENT),
]
fx = Inches(0.85); fw = Inches(2.85); fgap = Inches(0.13); fy = Inches(3.0)
for i,(n,d,c) in enumerate(flow):
    x = fx + (fw+fgap)*i
    rect(s, x, fy, fw, Inches(1.5), WHITE)
    rect(s, x, fy, fw, Inches(0.12), c)
    txt(s, x, fy+Inches(0.35), fw, Inches(0.5), [[(n,19,True,c)]], align=PP_ALIGN.CENTER)
    txt(s, x+Inches(0.12), fy+Inches(0.9), fw-Inches(0.24), Inches(0.5), [[(d,12.5,False,GRAY)]],
        align=PP_ALIGN.CENTER, spacing=1.1)
    if i < 3:
        txt(s, x+fw-Inches(0.02), fy+Inches(0.45), Inches(0.2), Inches(0.5),
            [[("+",20,True,RGBColor(0xBF,0xE5,0xCB))]], align=PP_ALIGN.CENTER)

txt(s, Inches(0.85), Inches(5.0), Inches(11.7), Inches(0.5), [[("프로젝트 결론", 15, True, ACCENT)]])
bullet(s, Inches(0.85), Inches(5.45), Inches(11.7), Inches(1.6),
       [
        "Spring Boot · React · Python(FastAPI ML) 3-Tier 풀스택으로 매출·재고·발주·배달·폐기를 통합",
        "기상청 데이터 + AI 수요예측으로 식자재 발주를 자동 추천해 폐기/품절을 동시에 절감",
        "각 구성원이 인증·AI·POS·DB·시각화 영역을 명확히 분담하고 브랜치 병합으로 통합 완성",
       ], size=14, gap=1.3, color=WHITE, mark_color=ACCENT)

# ============================================================
out = r"C:\Users\sds82\OneDrive\Desktop\캡스톤 디자인\intelliJ\foodguard\FoodGuard_팀_포트폴리오.pptx"
prs.save(out)
print("SAVED:", out)
print("slides:", len(prs.slides._sldIdLst))
