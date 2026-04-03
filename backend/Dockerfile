FROM python:3.11-slim

WORKDIR /app

# System dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY . .

# Default environment variables (override via .env or docker-compose)
ENV WHISPER_MODEL=large-v3-turbo
ENV WHISPER_LANGUAGE=ko
ENV WHISPER_DEVICE=auto
ENV WHISPER_COMPUTE_TYPE=int8
ENV RECORDINGS_PATH=./data/recordings
ENV SPEAKER_DB_PATH=./data/speakers.json
ENV ENCRYPTION_ENABLED=false
ENV AUTO_DELETE_DAYS=0
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8765
ENV SMTP_HOST=smtp.gmail.com
ENV SMTP_PORT=587
ENV SMTP_USE_TLS=true

# Data directory for persistent storage
RUN mkdir -p /app/data/recordings

EXPOSE 8765

CMD ["python", "server.py"]
