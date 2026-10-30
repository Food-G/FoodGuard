"""에이전트 등록부. 에이전트를 추가하면 여기에 한 줄 넣는다 (DEV_ROADMAP §4.5 표준 절차)."""

from __future__ import annotations

from fgagent.agents import echo, order_advisor

AGENTS = {m.NAME: m for m in (echo, order_advisor)}
