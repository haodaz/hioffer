# Python API for hioffer (FastAPI + the agent). The Next.js frontend deploys separately (Vercel).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 UV_SYSTEM_PYTHON=1
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY hioffer ./hioffer
COPY examples ./examples
# Pre-computed demo workspace so the deployed demo has data without spending model budget on boot.
COPY examples/demo-workspace ./workspace

ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", ".venv/bin/uvicorn hioffer.server:app --host 0.0.0.0 --port ${PORT}"]
