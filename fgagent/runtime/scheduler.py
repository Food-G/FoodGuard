"""APScheduler cron. 에이전트별 실행 시각은 SCHEDULES 에 등록한다 (DEV_ROADMAP §4.1).

대상 매장은 GET /api/stores (AGENT 조회 허용) 로 매번 새로 받는다.
"""

from __future__ import annotations

import logging

from fgagent.executor import WriteClient
from fgagent.runtime import runner
from fgcli.auth import get_token

log = logging.getLogger(__name__)

# agent → crontab (분 시 일 월 요일). echo 는 검증용이라 수동 실행만 한다.
# 예) "order_advisor": "0 8 * * *"   (AG-1 에서 추가)
SCHEDULES: dict[str, str] = {}


def store_ids() -> list[int]:
    stores = WriteClient(get_token("agent")).get("/api/stores")
    if not isinstance(stores, list):
        raise RuntimeError(f"매장 목록 조회 실패: {stores}")
    return [s["id"] for s in stores]


def run_for_all_stores(name: str) -> None:
    for sid in store_ids():
        rec = runner.run(name, sid, trigger="SCHEDULE")
        log.info("%s store=%s status=%s", name, sid, rec.get("status"))


def start():
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    sched = BackgroundScheduler(timezone="Asia/Seoul")
    for name, cron in SCHEDULES.items():
        sched.add_job(run_for_all_stores, CronTrigger.from_crontab(cron, timezone="Asia/Seoul"),
                      args=[name], id=name, max_instances=1, coalesce=True)
    sched.start()
    return sched
