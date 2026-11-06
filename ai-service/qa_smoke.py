"""
전 기능 점검: 시험 계정·매장을 새로 만들어 실제 API 로 실행한다 (ai-service 에서 실행).

    python qa_smoke.py run [http://localhost:8080]
    python qa_smoke.py cleanup

주의: 설정된 DB 에 시험 데이터를 쓴다. 끝나면 cleanup 으로 지운다 (qa-*@foodguard.test 와 그 매장만).
Claude 를 부르는 항목이 있어 비용이 조금 들고, AI 서비스와 claude 로그인이 필요하다.
횟수 제한(AI 분당 20회)을 시험하므로 연달아 돌리면 1분 기다린다. HQ 본사 id 90002 는 공유 DB 기준.
"""
import base64, hashlib, hmac, json, os, re, sys, time, urllib.error, urllib.request
from datetime import date, timedelta

sys.stdout.reconfigure(encoding='utf-8')
from database import engine  # noqa
from sqlalchemy import text  # noqa

BASE = (sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8080') + '/api'
secret = re.search(r'^JWT_SECRET=(.*)$', open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend', '.env'), encoding='utf-8').read(), re.M).group(1).strip()
b = lambda x: base64.urlsafe_b64encode(x).rstrip(b'=').decode()
results = []


def tok(u, r, exp=1200, sub=None):
    n = int(time.time())
    h = b(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    p = b(json.dumps({'sub': sub or f'check{u}@localhost.test', 'role': r, 'id': u, 'iat': n, 'exp': n + exp}).encode())
    return f'{h}.{p}.' + b(hmac.new(secret.encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest())


def api(method, path, body=None, t=None, raw=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    headers = {'Content-Type': 'application/json'}
    if t:
        headers['Authorization'] = 'Bearer ' + t
    req = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=170) as r:
            s = r.read().decode('utf-8')
            try:
                return r.status, json.loads(s)
            except ValueError:
                return r.status, s
    except urllib.error.HTTPError as e:
        s = e.read().decode('utf-8', 'replace')
        try:
            return e.code, json.loads(s)
        except ValueError:
            return e.code, s
    except Exception as e:
        return 0, str(e)


def check(name, got, want, detail=None):
    ok = got in want if isinstance(want, (list, tuple, set)) else got == want
    results.append((ok, name))
    if not ok or detail is not None:
        print(('PASS ' if ok else 'FAIL ') + name, '->', got, '' if ok else f'(기대 {want})', str(detail)[:240] if detail is not None else '')


def q(sql, **kw):
    with engine.connect() as c:
        return c.execute(text(sql), kw).fetchall()


def cleanup():
    users = [r[0] for r in q("SELECT user_id FROM USER WHERE email LIKE 'qa-%@foodguard.test'")]
    if not users:
        print('지울 시험 계정 없음')
        return
    stores = [r[0] for r in q("SELECT store_id FROM STORE WHERE hq_user_id IN :u".replace(':u', '(' + ','.join(map(str, users)) + ')'))]
    sl = ','.join(map(str, stores)) or '-1'
    ul = ','.join(map(str, users))
    with engine.begin() as c:
        c.execute(text(f"DELETE FROM MENU_INGREDIENT WHERE menu_id IN (SELECT menu_id FROM MENU WHERE store_id IN ({sl}))"))
        for t in ('menu_discount', 'STORE_EVENT_NOTE', 'SALES_DAY_FLAG', 'WASTE_RECORD', 'DONATION_RECORD', 'NOTIFICATION', 'PREDICTION_RESULT', 'SALES_DATA', 'ORDER_REQUEST', 'INVENTORY', 'INGREDIENT', 'MENU'):
            n = c.execute(text(f"DELETE FROM {t} WHERE store_id IN ({sl})")).rowcount
            print(' ', t, n)
        c.execute(text(f"DELETE FROM STORE WHERE store_id IN ({sl})"))
        c.execute(text(f"DELETE FROM USER WHERE user_id IN ({ul})"))
    print('시험 계정', len(users), '매장', len(stores), '삭제')
    print('남은 시험 계정', q("SELECT COUNT(*) FROM USER WHERE email LIKE 'qa-%@foodguard.test'")[0][0])


if sys.argv[1] == 'cleanup':
    cleanup()
    sys.exit()

ts = int(time.time())
pw = 'Qa-test-' + str(ts)
email = f'qa-{ts}@foodguard.test'
today = date.today()

# ── 인증 ──
check('가입: 정상', api('POST', '/auth/signup', {'email': email, 'password': pw, 'userName': 'QA', 'role': 'OWNER', 'storeName': 'QA매장', 'region': '서울', 'address': '서울시', 'phone': '010'})[0], 200)
check('가입: 중복 이메일 거부', api('POST', '/auth/signup', {'email': email, 'password': pw, 'userName': 'QA', 'role': 'OWNER'})[0], 400)
check('가입: 본사 역할 거부', api('POST', '/auth/signup', {'email': f'qa-h{ts}@foodguard.test', 'password': pw, 'userName': 'H', 'role': 'HQ_ADMIN'})[0], 400)
check('가입: 빈 이메일 거부', api('POST', '/auth/signup', {'email': '', 'password': pw, 'userName': 'x', 'role': 'OWNER'})[0], 400)
check('가입: 짧은 비밀번호 거부', api('POST', '/auth/signup', {'email': f'qa-s{ts}@foodguard.test', 'password': '1', 'userName': 'x', 'role': 'OWNER'})[0], 400)
check('가입: 이메일 형식 거부', api('POST', '/auth/signup', {'email': 'qa-notmail', 'password': pw, 'userName': 'x', 'role': 'OWNER'})[0], 400)
c, T = api('POST', '/auth/login', {'email': email, 'password': pw})
check('로그인: 정상', c, 200)
c1, m1 = api('POST', '/auth/login', {'email': email, 'password': 'wrong'})
c2, m2 = api('POST', '/auth/login', {'email': 'qa-none@foodguard.test', 'password': 'wrong'})
check('로그인: 틀린 비밀번호 거부', c1, [400, 401])
check('로그인: 이메일 존재 여부를 숨김', m1 == m2, True, f'{m1} / {m2}')
check('로그인: 빈 본문 500 아님', api('POST', '/auth/login', {})[0], [400, 401])
claims = json.loads(base64.urlsafe_b64decode(T.split('.')[1] + '=='))
uid = claims['id']
H = tok(90002, 'HQ_ADMIN')
check('토큰 없음 401', api('GET', '/users/me')[0], 401)
check('만료 토큰 401', api('GET', '/users/me', t=tok(uid, 'OWNER', exp=-10, sub=email))[0], 401)
check('위조 토큰 401', api('GET', '/users/me', t=T[:-3] + 'abc')[0], 401)

c, me = api('GET', '/users/me', t=T)
check('내 정보', c, 200)
check('내 정보에 비밀번호 없음', 'password' in json.dumps(me).lower(), False, me if 'password' in json.dumps(me).lower() else None)
check('이름 변경', api('PUT', '/users/me', {'userName': 'QA2'}, T)[0], 200)
check('비밀번호 변경: 틀린 현재값', api('PUT', '/users/me/password', {'oldPassword': 'x', 'newPassword': pw + 'a'}, T)[0], 400)
check('비밀번호 변경: 짧은 값 거부', api('PUT', '/users/me/password', {'oldPassword': pw, 'newPassword': '1'}, T)[0], 400)
check('비밀번호 변경: 정상', api('PUT', '/users/me/password', {'oldPassword': pw, 'newPassword': pw + 'a'}, T)[0], 200)
pw += 'a'
check('새 비밀번호 로그인', api('POST', '/auth/login', {'email': email, 'password': pw})[0], 200)

# ── 매장 ──
c, stores = api('GET', f'/stores/my/{uid}', t=T)
check('내 매장', c, 200)
S = stores[0]['id']
check('매장 수정', api('PUT', f'/stores/{S}', {'storeName': 'QA매장2', 'address': '서울', 'phone': '011', 'region': '서울'}, T)[0], 200)
check('매장 응답에 사용자 정보 없음', 'password' in json.dumps(stores), False)
check('다른 사용자 매장 목록 403', api('GET', '/stores/my/1', t=T)[0], 403)
check('전체 매장: 점주 403', api('GET', '/stores', t=T)[0], 403)
c, allstores = api('GET', '/stores', t=H)
check('전체 매장: 본사', c, 200)
check('전체 매장 응답에 비밀번호 없음', 'password' in json.dumps(allstores).lower(), False)
check('다른 매장 수정 403', api('PUT', '/stores/60004', {'storeName': 'x'}, T)[0], 403)

# ── 식자재·메뉴·레시피 ──
c, ing = api('POST', '/ingredients', {'storeId': S, 'name': f'QA양상추{ts}', 'unit': 'kg', 'category': '채소'}, T)
check('식자재 등록', c, 200, None if c == 200 else ing)
I = ing['id']
check('식자재 조회', api('GET', f'/ingredients?storeId={S}', t=T)[0], 200)
check('식자재 설정 저장', api('PUT', f'/ingredients/{I}', {'name': ing['name'], 'category': '채소', 'unit': 'kg', 'shelfLifeDays': 4, 'leadTimeDays': 1, 'orderCycleDays': 3}, T)[0], 200)
check('식자재 음수 설정 거부', api('PUT', f'/ingredients/{I}', {'name': ing['name'], 'unit': 'kg', 'shelfLifeDays': -1}, T)[0], 400)
check('식자재: 필수값 누락 400', api('POST', '/ingredients', {'storeId': S}, T)[0], 400)
c, tmp = api('POST', '/ingredients', {'storeId': S, 'name': f'QA삭제{ts}', 'unit': '개'}, T)
check('식자재 삭제', api('DELETE', f"/ingredients/{tmp['id']}", t=T)[0], [200, 204])
c, menu = api('POST', '/menus', {'storeId': S, 'menuName': 'QA버거', 'price': 8000, 'category': '버거'}, T)
check('메뉴 등록', c, 200, None if c == 200 else menu)
M = menu['id']
c, menu2 = api('POST', '/menus', {'storeId': S, 'menuName': 'QA삭제메뉴', 'price': 1000}, T)
check('메뉴 수정', api('PUT', f'/menus/{M}', {'menuName': 'QA버거', 'price': 8000, 'category': '버거'}, T)[0], 200)
check('메뉴 음수 가격 거부', api('POST', '/menus', {'storeId': S, 'menuName': 'x', 'price': -1}, T)[0], 400)
check('메뉴 비활성화', api('DELETE', f"/menus/{menu2['id']}", t=T)[0], [200, 204])
check('메뉴 조회: 비활성 제외', len(api('GET', f'/menus/{S}', t=T)[1]), 1)
check('다른 매장에 메뉴 등록 403', api('POST', '/menus', {'storeId': 60004, 'menuName': 'x', 'price': 1}, T)[0], 403)
c, mi = api('POST', '/menu-ingredients', {'menuId': M, 'ingredientId': I, 'qtyPerUnit': 100, 'unit': 'g'}, T)
check('레시피 등록', c, 200, None if c == 200 else mi)
check('레시피 조회', api('GET', f'/menu-ingredients/menu/{M}', t=T)[0], 200)
check('레시피 0 수량 거부', api('POST', '/menu-ingredients', {'menuId': M, 'ingredientId': I, 'qtyPerUnit': 0, 'unit': 'g'}, T)[0], 400)

# ── 판매·플래그·특이사항 ──
for i in range(1, 36):
    d = today - timedelta(days=i)
    c, _ = api('POST', '/sales', {'storeId': S, 'menuId': M, 'quantity': 20 + (d.weekday() * 3), 'saleDate': d.isoformat()}, T)
    if c != 200:
        check('판매 등록', c, 200, _)
        break
check('판매 조회', len(api('GET', f'/sales/{S}', t=T)[1]), 35)
check('판매 기간 조회', api('GET', f'/sales/{S}/range?start={today - timedelta(days=7)}&end={today}', t=T)[0], 200)
check('판매: 음수 수량 거부', api('POST', '/sales', {'storeId': S, 'menuId': M, 'quantity': -5, 'saleDate': today.isoformat()}, T)[0], 400)
check('판매: 잘못된 날짜 400', api('POST', '/sales', {'storeId': S, 'menuId': M, 'quantity': 1, 'saleDate': 'x'}, T)[0], 400)
check('판매: 필수값 누락 400', api('POST', '/sales', {'storeId': S}, T)[0], 400)
check('판매: 다른 매장 메뉴 403', api('POST', '/sales', {'storeId': S, 'menuId': 60001, 'quantity': 1, 'saleDate': today.isoformat()}, T)[0], 403)
check('잘못된 JSON 400', api('POST', '/sales', t=T, raw=b'{bad')[0], 400)
c, fl = api('POST', '/sales-flags', {'storeId': S, 'flagType': 'SOLD_OUT', 'menuId': M, 'flagDate': (today - timedelta(days=3)).isoformat()}, T)
check('품절 기록', c, 200, None if c == 200 else fl)
check('휴무 기록', api('POST', '/sales-flags', {'storeId': S, 'flagType': 'CLOSED', 'flagDate': (today - timedelta(days=40)).isoformat()}, T)[0], 200)
check('기록 조회', len(api('GET', f'/sales-flags/{S}', t=T)[1]), 2)
check('기록 삭제', api('DELETE', f"/sales-flags/{fl['id']}", t=T)[0], [200, 204])
check('잘못된 기록 유형 거부', api('POST', '/sales-flags', {'storeId': S, 'flagType': 'X', 'flagDate': today.isoformat()}, T)[0], 400)
check('특이사항 조회', api('GET', f'/event-notes/{S}', t=T)[0], 200)
c, note = api('POST', '/event-notes', {'storeId': S, 'eventDate': (today + timedelta(days=2)).isoformat(), 'note': '점심 단체 예약 30명'}, T)
check('특이사항 등록 (Claude)', c, 200, json.dumps(note, ensure_ascii=False)[:150])
check('특이사항 빈 메모 거부', api('POST', '/event-notes', {'storeId': S, 'eventDate': today.isoformat(), 'note': ' '}, T)[0], 400)
if c == 200:
    check('특이사항 삭제', api('DELETE', f"/event-notes/{note['id']}", t=T)[0], [200, 204])

# ── 예측 ──
start = time.time()
c, pr = api('POST', f'/predictions/{S}/trigger', t=T)
check('AI 예측 실행', c, 200, f'{time.time() - start:.1f}초 ' + (json.dumps(pr, ensure_ascii=False)[:120] if c != 200 else ''))
c, preds = api('GET', f'/predictions/{S}', t=T)
check('예측 조회', c, 200)
check('예측 7일', len(preds), 7, None if len(preds) == 7 else preds[:1])
check('예측 요약', api('GET', f'/predictions/{S}/summary', t=T)[0], 200)
check('예측 값 양수', all(p.get('predictedQty', 0) > 0 for p in preds), True)

# ── 발주 전체 흐름 ──
c, recs = api('GET', f'/orders/recommend/{S}', t=T)
check('발주 추천', c, 200)
check('추천에 식자재 있음', len(recs) >= 1, True)
cover = recs[0]['coverageDays'] if recs else None
check('보관 4 주기 3 → 3일치 + 이월 안전재고', cover, 3)
c, ex = api('POST', f'/orders/recommend/{S}/explain', {}, T)
check('추천 근거 설명 (Claude)', c, 200)
c, rv = api('POST', f'/orders/recommend/{S}/review', {}, T)
check('발주 참모 (Claude)', c, 200)
c, o = api('POST', '/orders', {'storeId': S, 'ingredientId': I, 'quantity': 5}, T)
check('발주 신청', c, 200, None if c == 200 else o)
OID = o['id']
check('발주 응답 직렬화', isinstance(o.get('store', {}), dict), True)
check('발주: 음수 수량 거부', api('POST', '/orders', {'storeId': S, 'ingredientId': I, 'quantity': -1}, T)[0], 400)
check('발주: 다른 매장 식자재 거부', api('POST', '/orders', {'storeId': S, 'ingredientId': 999999, 'quantity': 1}, T)[0], 400)
check('발주 내역', api('GET', f'/orders/{S}', t=T)[0], 200)
check('점주가 승인 403', api('PUT', f'/orders/{OID}/status', {'status': 'APPROVED'}, T)[0], 403)
check('본사 전체 발주', api('GET', '/orders/admin/all', t=H)[0], 200)
c, a = api('PUT', f'/orders/{OID}/status', {'status': 'APPROVED'}, H)
check('본사 승인', c, 200, None if c == 200 else a)
check('잘못된 상태값 거부', api('PUT', f'/orders/{OID}/status', {'status': 'WHAT'}, H)[0], 400)
c, sent = api('POST', f'/orders/{OID}/hq-send', {'expiryDate': (today + timedelta(days=2)).isoformat()}, H)
check('본사 발송', c, 200, None if c == 200 else sent)
qr = q("SELECT qr_token, delivery_token FROM ORDER_REQUEST WHERE order_id=:i", i=OID)[0]
print('  토큰 있음', bool(qr[0]), bool(qr[1]))
if qr[1]:
    check('기사 배달 정보', api('GET', f'/delivery/{qr[1]}')[0], 200)
check('없는 배달 토큰 404', api('GET', '/delivery/nope')[0], 404)
c, d1 = api('GET', f'/orders/driver-scan?token={qr[0]}')
check('기사 QR 수령', c, 200, None if c == 200 else d1)
c, d2 = api('GET', f'/orders/driver-scan?token={qr[0]}')
check('기사 QR 중복 스캔 안전', c, [200, 400])
c, o1 = api('GET', f'/orders/owner-scan?token={qr[0]}')
check('점주 QR 입고', c, 200, None if c == 200 else o1)
c, inv = api('GET', f'/inventory/{S}', t=T)
check('입고 후 재고 5', [float(x.get('currentQty', 0)) for x in inv if x['ingredient']['id'] == I], [[5.0]], None)
c, o2 = api('GET', f'/orders/owner-scan?token={qr[0]}')
inv2 = api('GET', f'/inventory/{S}', t=T)[1]
check('점주 QR 재스캔해도 재고 안 늘어남', [float(x.get('currentQty', 0)) for x in inv2 if x['ingredient']['id'] == I], [[5.0]])
c, o3 = api('POST', '/orders', {'storeId': S, 'ingredientId': I, 'quantity': 1}, T)
check('요청 상태 취소', api('DELETE', f"/orders/{o3['id']}", t=T)[0], 200)
check('완료 발주 취소 거부', api('DELETE', f'/orders/{OID}', t=T)[0], 400)

# ── 폐기·기부·감시·할인·POS ──
check('폐기 예측', api('GET', f'/waste-prediction/{S}', t=T)[0], 200)
check('폐기 요약', api('GET', f'/waste-prediction/{S}/summary', t=T)[0], 200)
check('감시', api('GET', f'/watchdog/{S}', t=T)[0], 200)
c, w = api('POST', '/waste-records', {'storeId': S, 'ingredientId': I, 'quantity': 1, 'reason': 'EXPIRED'}, T)
check('폐기 기록', c, 200, None if c == 200 else w)
check('폐기: 재고보다 많이 거부', api('POST', '/waste-records', {'storeId': S, 'ingredientId': I, 'quantity': 999}, T)[0], 400)
c, dn = api('POST', f'/donations/{S}', {'ingredientId': I, 'ingredientName': ing['name'], 'quantity': 1, 'unit': 'kg', 'donationType': 'INGREDIENT', 'orgName': 'QA기관', 'orgType': 'FOOD_BANK', 'orgContact': '010', 'description': 'x'}, T)
check('기부 등록', c, 200, None if c == 200 else dn)
check('기부: 재고 초과 거부', api('POST', f'/donations/{S}', {'ingredientId': I, 'ingredientName': ing['name'], 'quantity': 999, 'unit': 'kg', 'donationType': 'INGREDIENT', 'orgName': 'Q'}, T)[0], 400)
check('기부 이력', api('GET', f'/donations/store/{S}', t=T)[0], 200)
if c == 200:
    check('기부 완료', api('POST', f"/donations/{dn['id']}/complete", {}, T)[0], 200)
    check('완료 기부 취소 거부', api('POST', f"/donations/{dn['id']}/cancel", {}, T)[0], 400)
c, cand = api('GET', f'/discounts/store/{S}/candidates', t=T)
check('할인 후보', c, 200)
check('할인 적용', api('POST', '/discounts', {'storeId': S, 'menuId': M, 'ingredientId': I, 'discountPct': 25, 'endDate': (today + timedelta(days=1)).isoformat()}, T)[0], 200)
c, co = api('POST', f'/pos/{S}/checkout', [{'menuId': M, 'quantity': 2}], T)
check('POS 결제 금액 = 할인가', co.get('total') if c == 200 else c, 12000, None if c == 200 else co)
check('POS 재고 차감', [round(float(x['currentQty']), 2) for x in api('GET', f'/inventory/{S}', t=T)[1] if x['ingredient']['id'] == I], [[2.8]])
check('POS 빈 결제 거부', api('POST', f'/pos/{S}/checkout', [], T)[0], 400)

# ── 알림·AI 입력·본사 ──
c, n = api('POST', '/notifications', {'storeId': S, 'message': 'qa', 'type': 'STOCK'}, T)
check('알림 생성', c, 200)
c, un = api('GET', f'/notifications/{S}/unread', t=T)
check('안 읽은 알림', c, 200)
if un:
    check('알림 읽음', api('PUT', f"/notifications/{un[0]['id']}/read", t=T)[0], 200)
c, sg = api('POST', f'/ingredients/suggest/{S}', {}, T)
check('식자재 설정 제안 (Claude)', c, 200, None if c == 200 else sg)
c, ask = api('POST', f'/assistant/{S}/ask', {'question': '지금 할인 중인 메뉴 알려줘'}, T)
check('비서 (Claude)', c, 200)
if c == 200:
    check('비서 숫자 일치', ask.get('unverifiedNumbers'), [[]], ask.get('answer'))
csv = base64.b64encode(f'일자,메뉴,수량\n{(today - timedelta(days=50)).isoformat()},QA버거,3\n'.encode()).decode()
c, pv = api('POST', f'/ingest/{S}/sales/preview', {'filename': 'a.csv', 'contentBase64': csv}, T)
check('POS 파일 미리보기 (Claude)', c, 200, None if c == 200 else pv)
check('통계', api('GET', '/stats/hq', t=H)[0], 200)
check('전 매장 주간 매출', api('GET', '/sales/all-stores/weekly-summary', t=H)[0], 200)
check('주간 리포트 (Claude)', api('POST', '/stats/hq/weekly-report', {}, H)[0], 200)
check('점주 통계 403', api('GET', '/stats/hq', t=T)[0], 403)

# ── 권한 교차 ──
for path, m in [(f'/sales/60004', 'GET'), ('/inventory/60004', 'GET'), ('/orders/60004', 'GET'), ('/predictions/60004', 'GET'), ('/watchdog/60004', 'GET'), ('/donations/store/60004', 'GET'), ('/waste-prediction/60004', 'GET'), ('/event-notes/60004', 'GET'), ('/notifications/60004/unread', 'GET'), ('/ingredients?storeId=60004', 'GET')]:
    check(f'다른 매장 {path} 403', api(m, path, t=T)[0], 403)
check('다른 매장 전체 재고 삭제 403', api('DELETE', '/inventory/store/60004', t=T)[0], 403)
c = api('GET', '/stores/my/' + str(uid))[0]
check('토큰 없이 보호 API 401', c, 401)

# ── 운영 안전 ──
check('상태 확인', api('GET', '/health')[1], [{'status': 'ok'}])
c, r = api('GET', '/nope', t=T)
check('없는 주소 404', c, 404)
c, r = api('POST', '/sales', {'storeId': S, 'menuId': M, 'quantity': 'abc', 'saleDate': 'x'}, T)
check('오류에 내부 내용 없음', any(w in json.dumps(r, ensure_ascii=False) for w in ('java.', 'Exception', 'SQL', 'hibernate', 'For input')), False, r)
c, r = api('GET', '/inventory/store/1', t=T)
check('허용 안 된 메서드 405', c, 405)
codes = [api('POST', f'/assistant/{S}/ask', {'question': ' '}, T)[0] for _ in range(25)]
check('AI 호출 횟수 제한 429', 429 in codes, True, f'400={codes.count(400)} 429={codes.count(429)}')
blocked = email
for _ in range(11):
    c, m = api('POST', '/auth/login', {'email': blocked, 'password': 'wrong'})
check('로그인 실패 반복 차단', '막혔' in str(m), True, m)
check('차단 중에는 맞는 비밀번호도 거부', api('POST', '/auth/login', {'email': blocked, 'password': pw})[0], 401)

bad = [n for ok, n in results if not ok]
print(f'\n합계 {len(results)}개, 통과 {len(results) - len(bad)}개, 실패 {len(bad)}개')
for n in bad:
    print(' -', n)
