# 🤖 FoodGuard AI Collaboration Guide (Root)

우리 팀은 Gemini CLI를 활용한 **Vibe Coding**과 GitHub을 통해 협업합니다. 모든 팀원은 이 가이드를 준수하여 코드의 통일성을 유지합니다.

## 👥 협업 프로세스
1. **GitHub Workflow**: 모든 작업은 `feature/기능명` 브랜치에서 진행하며, 완료 후 PR을 통해 병합합니다.
2. **AI Instruction**: Gemini CLI 사용 시, 도구 호출 전 반드시 작업 의도와 변경 사유를 한 줄로 설명합니다.
3. **Context Awareness**: 작업 전 반드시 프로젝트 구조와 기존 코드를 분석하여 스타일을 맞춥니다.

## 🛠 공통 기술 표준
- **Runtime**: Java 17, Node.js v20 LTS
- **Database**: MySQL 8.0.45 (Strict Versioning)
- **Architecture**: Spring Boot (Backend) + React TypeScript (Frontend)

## 📁 디렉토리 구조
- `/backend`: Spring Boot 기반 API 서버
- `/frontend`: Vite + React 기반 웹 클라이언트
- `/sample`: 디자인 및 코드 레퍼런스 (UI 구현 시 최우선 참고)
