"""
작업 보드 동기화 계획 만들기 (읽기 전용: git 만 읽고 결과를 JSON 으로 출력한다).

보드(https://claude.ai/artifact/RNRMZgYC3tG78Lc5HJWw81)의 카드 데이터를 내려받은 폴더와
브랜치(dev·jihwan·hyeon·junho·jhy)의 커밋을 비교해, 카드에 붙일 커밋과 바꿀 상태, 카드 번호가 없는
커밋(새 카드 후보)을 알려 준다. 보드에 쓰는 일은 이 결과를 보고 Claude 가 ArtifactData 로 한다.

    git fetch origin
    python agent/board_sync.py --nodes <ArtifactData list out_dir>/nodes [--since 2026-11-01]

카드 연결 규칙: 커밋 메시지에 [y5] 처럼 카드 번호를 대괄호로 쓴다 (여러 개 가능).
상태 규칙: 배포 브랜치(dev, 11/20 부터)에 들어간 커밋이 있으면 완료, 새 커밋만 있으면 진행 중.
재작업·막힘 카드는 상태를 바꾸지 않고 커밋만 붙인다.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# 커밋의 "브랜치"는 이 순서로 처음 닿는 브랜치 (배포 브랜치 dev 먼저, 통합본 jhy 는 마지막)
BRANCHES = ["dev", "jihwan", "hyeon", "junho", "jhy"]
DEPLOY = "dev"
TAG = re.compile(r"\[#?([A-Za-z][A-Za-z0-9]{0,23})\]")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def load_cards(nodes_dir: Path) -> dict:
    cards = {}
    for f in nodes_dir.glob("*.json"):
        doc = json.loads(f.read_text(encoding="utf-8"))
        cards[f.stem] = doc.get("data", doc)  # 파일이 {id, data, version} 이든 본문만이든
    return cards


DEPLOY_FILES = ["docker-compose.yml", "frontend/Dockerfile", "frontend/nginx.conf", "backend/Dockerfile", "ai-service/Dockerfile"]


def summary(server_commit: str | None) -> dict:
    """보드 위쪽 상태 막대용: 배포 브랜치와 서버, 브랜치별 배포 브랜치와의 차이·경고 (보드 meta/branches 문서)."""
    def last(ref):
        h, a, d, s = git("log", "-1", "--format=%h%x1f%an%x1f%ad%x1f%s", "--date=format:%m-%d %H:%M", ref).strip().split("\x1f", 3)
        return {"hash": h, "author": a, "date": d, "msg": s}
    head = f"origin/{DEPLOY}"
    deploy = {"branch": DEPLOY, "head": last(head)}
    if server_commit:
        deploy["server"] = server_commit[:7]
        deploy["undeployed"] = int(git("rev-list", "--count", f"{server_commit}..{head}").strip() or 0)
    deploy_files = set(git("ls-tree", "-r", "--name-only", head).split())
    rows = []
    for b in BRANCHES:
        if b == DEPLOY:
            continue
        ref = f"origin/{b}"
        warn = [f"배포 파일 없음: {f}" for f in DEPLOY_FILES if f in deploy_files and git("ls-tree", "--name-only", ref, f).strip() == ""]
        gone = [l for l in git("diff", "--name-status", "--diff-filter=D", f"{head}...{ref}").splitlines() if l]
        if len(gone) >= 10:
            warn.append(f"{DEPLOY} 대비 지운 파일 {len(gone)}개")
        rows.append({"name": b, "ahead": int(git("rev-list", "--count", f"{head}..{ref}").strip()),
                     "behind": int(git("rev-list", "--count", f"{ref}..{head}").strip()), "last": last(ref), "warn": warn})
    return {"deploy": deploy, "branches": rows}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nodes", required=True, help="ArtifactData list 의 out_dir 아래 nodes 폴더")
    ap.add_argument("--since", default="2026-10-01", help="이 날짜 이후 커밋만 본다")
    ap.add_argument("--server-commit", help="배포 서버가 돌리는 커밋 (서버에서 git log -1 로 확인). 주면 미배포 커밋 수를 낸다")
    args = ap.parse_args()

    cards = load_cards(Path(args.nodes))
    reach = {b: set(git("rev-list", f"origin/{b}").split()) for b in BRANCHES}

    commits = {}
    for b in BRANCHES:
        out = git("log", f"origin/{b}", "--no-merges", f"--since={args.since}", "--format=%H%x1f%an%x1f%ad%x1f%s", "--date=short")
        for line in out.splitlines():
            h, author, date, msg = line.split("\x1f", 3)
            if h in commits:
                continue
            origin = next(x for x in BRANCHES if h in reach[x])
            commits[h] = {"hash": h, "msg": msg, "author": author, "date": date, "branch": origin, "merged": h in reach[DEPLOY]}

    link, merged_now, status, untagged = {}, {}, {}, {}
    for c in sorted(commits.values(), key=lambda x: x["date"]):
        ids = [i for i in TAG.findall(c["msg"]) if i in cards]
        if not ids:
            untagged.setdefault(c["branch"], []).append({k: c[k] for k in ("hash", "msg", "author", "date")})
            continue
        for cid in ids:
            known = {x.get("hash"): x for x in cards[cid].get("commits", [])}
            if c["hash"] not in known:
                link.setdefault(cid, []).append(c)
            elif c["merged"] and not known[c["hash"]].get("merged"):
                merged_now.setdefault(cid, []).append(c["hash"])

    for cid in set(link) | set(merged_now):
        cur = cards[cid].get("status", "todo")
        if cur in ("rework", "blocked"):
            continue
        all_c = cards[cid].get("commits", []) + link.get(cid, [])
        if any(x.get("merged") for x in all_c) or merged_now.get(cid):
            new = "done"
        elif cur == "todo":
            new = "doing"
        else:
            continue
        if new != cur:
            status[cid] = new

    json.dump({"link": link, "merged_now": merged_now, "status": status, "untagged": untagged, "summary": summary(args.server_commit)},
              sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
