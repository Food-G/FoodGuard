"""에이전트 등록부. 에이전트를 추가하면 여기에 한 줄 넣는다 (DEV_ROADMAP §4.5 표준 절차)."""

from __future__ import annotations

from fgagent.agents import (auditor, donation_matcher, echo, hq_review, inbound, mlops, order_advisor, waste_guard,
                            weekly_brief)

AGENTS = {m.NAME: m for m in (echo, order_advisor, waste_guard, donation_matcher, mlops, hq_review, auditor, inbound,
                              weekly_brief)}
