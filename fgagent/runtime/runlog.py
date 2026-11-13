"""AGENT_RUN 기록 + agent-runs/*.json 로컬 백업 (시연 replay·DB 장애 대비).

서버 기록이 실패해도(마이그레이션 전, 백엔드 다운) 실행은 계속하고 로컬 파일은 항상 남긴다.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from fgagent.executor import WriteClient

RUNS_DIR = Path(__file__).resolve().parents[2] / "agent-runs"


class RunLog:
    def __init__(self, client: WriteClient, agent: str, store_id: int | None, trigger: str,
                 run_id: str | None = None):
        self.client = client
        self.run_id = run_id or str(uuid.uuid4())
        self.record: dict = {"runId": self.run_id, "agent": agent, "storeId": store_id,
                             "triggerType": trigger, "startedAt": datetime.now().isoformat(),
                             "warnings": []}

    def start(self, model: str | None) -> None:
        status, body = self.client.post("/api/agent/runs", {
            "runId": self.run_id, "agent": self.record["agent"], "storeId": self.record["storeId"],
            "triggerType": self.record["triggerType"], "model": model,
        })
        self.remote = status == 200
        if not self.remote:
            self.record["warnings"].append(f"AGENT_RUN 기록 실패 ({status}): {str(body)[:200]}")

    def phase(self, name: str) -> None:
        """단계 진입을 서버에 알린다 (대시보드 실시간 표시). 실패해도 실행은 계속한다."""
        self.record.setdefault("progress", []).append({"phase": name, "at": datetime.now().isoformat()})
        if getattr(self, "remote", False):
            code, body = self.client.put(f"/api/agent/runs/{self.run_id}/progress", {"phase": name})
            if code != 200:
                self.record["warnings"].append(f"진행 단계 기록 실패 {name} ({code}): {str(body)[:200]}")

    def finish(self, status: str, result: dict | None = None, error: str | None = None,
               model: str | None = None, usage: dict | None = None) -> Path:
        usage = usage or {}
        self.record.update({"status": status, "finishedAt": datetime.now().isoformat(),
                            "model": model, "usage": usage, "result": result, "error": error})
        if getattr(self, "remote", False):
            code, body = self.client.put(f"/api/agent/runs/{self.run_id}", {
                "status": status, "model": model, "result": result, "error": error,
                "inputTokens": usage.get("inputTokens"), "outputTokens": usage.get("outputTokens"),
            })
            if code != 200:
                self.record["warnings"].append(f"AGENT_RUN 종료 기록 실패 ({code}): {str(body)[:200]}")
        RUNS_DIR.mkdir(exist_ok=True)
        path = RUNS_DIR / (f"{datetime.now():%Y%m%d-%H%M%S}-{self.record['agent']}-"
                           f"{self.record['storeId']}-{self.run_id[:8]}.json")
        path.write_text(json.dumps(self.record, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return path
