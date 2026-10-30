"""에이전트 공통 런타임 (DEV_ROADMAP AG-0.2).

    tools.py     fgcli COMMANDS → Claude 도구 정의 (읽기 전용)
    loop.py      Claude API tool-use 루프 (API 키가 없으면 claude -p 폴백)
    runlog.py    AGENT_RUN 기록 + agent-runs/*.json 로컬 백업
    proposals.py 제안 제출 → Spring /api/agent/proposals
    runner.py    에이전트 1회 실행: observe → decide → LLM → 제안
    scheduler.py APScheduler cron
"""
