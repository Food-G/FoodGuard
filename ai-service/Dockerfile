FROM python:3.11-slim
RUN useradd --create-home foodguard \
    && apt-get update && apt-get install -y --no-install-recommends curl libgomp1 nodejs npm \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p trained_models && chown -R foodguard /app
USER foodguard
# 컨테이너 안에서만 열리고 compose 가 외부 포트를 내지 않는다. main.py 가 INTERNAL_API_KEY 없이는 기동을 거부한다
ENV AI_SERVICE_HOST=0.0.0.0 TZ=Asia/Seoul
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fs http://localhost:8000/health || exit 1
CMD ["python", "main.py"]
