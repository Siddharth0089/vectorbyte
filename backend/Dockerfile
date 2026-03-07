# ============================================================
# Backend Dockerfile — FastAPI + OpenCV + PyTorch + vtracer
# ============================================================
FROM python:3.11-slim AS base

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# ---- System dependencies ----
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
        libcairo2-dev \
        libffi-dev \
        shared-mime-info \
        potrace \
        wget \
        curl \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g svgo \
    && apt-get purge -y --auto-remove curl gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---- Python dependencies ----
COPY requirements.txt .
# Install CPU-only PyTorch first with strict memory limits
RUN pip install --upgrade pip \
    && pip install --no-cache-dir torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# ---- Download Real-ESRGAN model weights ----
COPY download_models.sh .
RUN chmod +x download_models.sh && ./download_models.sh

# ---- Application code ----
COPY app/ ./app/

# ---- Create uploads directory with open permissions (Kali compat) ----
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
