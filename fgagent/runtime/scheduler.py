"""APScheduler cron. 에이전트별 실행 시각은 SCHEDULES 에 등록한다 (DEV_ROADMAP §4.1).

대상 매장은 GET /api/stores (AGENT 조회 허용) 로 매번 새로 받는다.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime

from fgagent.agents import hq_review, inbound
from fgagent.executor import WriteClient
from fgagent.runtime import runner
from fgcli.auth import get_token

log = logging.getLogger(__name__)

# agent → crontab (분 시 일 월 요일). echo 는 검증용이라 수동 실행만 한다.
SCHEDULES: dict[str, str] = {
    "audit": "30 6 * * *",
    "mlops": "0 7 * * *",
    "order_advisor": "0 8 * * *",
    "waste": "0 9 * * *",
}

HQ_REVIEW_POLL = "*/5 * * * *"
FAILURE_BACKOFF_SEC = 3600  # 실패한 매장은 한 시간 쉰다 (LLM 장애 때 5분마다 재시도해 비용이 새지 않게)
_failed_at: dict[int, float] = {}

INBOUND_POLL = "0 * * * *"
INBOUND_REPEAT_SEC = 24 * 3600  # 지연이 그대로면 하루에 한 번만 다시 알린다 (서버의 24시간 중복 금지와 같은 주기)
_inbound_seen: dict[int, tuple[frozenset, float]] = {}


def store_ids() -> list[int]:
    stores = WriteClient(get_token("agent")).get("/api/stores")
    if not isinstance(stores, list):
        raise RuntimeError(f"매장 목록 조회 실패: {stores}")
    return [s["id"] for s in stores]


def run_for_all_stores(name: str) -> None:
    for sid in store_ids():
        rec = runner.run(name, sid, trigger="SCHEDULE")
        log.info("%s store=%s status=%s", name, sid, rec.get("status"))


def stores_to_review(client, now: float) -> list[int]:
    """심사하지 않은 승인 대기 발주가 있는 매장. 없으면 실행 기록도 LLM 호출도 만들지 않는다."""
    orders = client.get("/api/orders/admin/all")
    if not isinstance(orders, list):
        raise RuntimeError(f"발주 목록 조회 실패: {orders}")
    by_store: dict[int, list[dict]] = {}
    for o in orders:
        by_store.setdefault(o["store"]["id"], []).append(o)
    return [sid for sid, rows in sorted(by_store.items())
            if any(o["status"] == "REQUESTED" for o in rows)
            and now - _failed_at.get(sid, 0) >= FAILURE_BACKOFF_SEC
            and hq_review.unreviewed(rows, hq_review.fetch_flags(client, sid))]


def poll_hq_review() -> None:
    try:
        for sid in stores_to_review(WriteClient(get_token("agent")), time.time()):
            rec = runner.run("hq_review", sid, trigger="EVENT")
            log.info("hq_review store=%s status=%s", sid, rec.get("status"))
            if rec.get("status") == "OK":
                _failed_at.pop(sid, None)
            else:
                _failed_at[sid] = time.time()
    except (RuntimeError, OSError, SystemExit) as e:  # 로그인 실패·마이그레이션 전 등. 다음 폴링에서 다시 본다
        log.warning("hq_review 폴링 실패: %s", e)


def stores_with_new_delays(orders: list[dict], now: datetime, seen_at: float) -> list[int]:
    """지연이 있고 지난번과 달라졌거나 24시간이 지난 매장. 그대로면 실행 기록을 매시 쌓지 않는다."""
    by_store: dict[int, list[dict]] = {}
    for o in orders:
        by_store.setdefault(o["store"]["id"], []).append(o)
    targets = []
    for sid, rows in sorted(by_store.items()):
        key = inbound.delay_key(rows, now)
        last_key, last_at = _inbound_seen.get(sid, (None, 0.0))
        if key and (key != last_key or seen_at - last_at >= INBOUND_REPEAT_SEC):
            targets.append(sid)
    return targets


def poll_inbound() -> None:
    try:
        orders = WriteClient(get_token("agent")).get("/api/orders/admin/all")
        if not isinstance(orders, list):
            raise RuntimeError(f"발주 목록 조회 실패: {orders}")
        now = datetime.now()
        for sid in stores_with_new_delays(orders, now, time.time()):
            rec = runner.run("inbound", sid, trigger="SCHEDULE", use_llm=False)
            log.info("inbound store=%s status=%s", sid, rec.get("status"))
            if rec.get("status") == "OK":
                rows = [o for o in orders if o["store"]["id"] == sid]
                _inbound_seen[sid] = (inbound.delay_key(rows, now), time.time())
    except (RuntimeError, OSError, SystemExit) as e:
        log.warning("inbound 폴링 실패: %s", e)


def start():
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    sched = BackgroundScheduler(timezone="Asia/Seoul")
    for name, cron in SCHEDULES.items():
        sched.add_job(run_for_all_stores, CronTrigger.from_crontab(cron, timezone="Asia/Seoul"),
                      args=[name], id=name, max_instances=1, coalesce=True)
    sched.add_job(poll_hq_review, CronTrigger.from_crontab(HQ_REVIEW_POLL, timezone="Asia/Seoul"),
                  id="hq_review_poll", max_instances=1, coalesce=True)
    sched.add_job(poll_inbound, CronTrigger.from_crontab(INBOUND_POLL, timezone="Asia/Seoul"),
                  id="inbound_poll", max_instances=1, coalesce=True)
    sched.start()
    return sched
