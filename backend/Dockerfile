FROM ghcr.io/changsu-jin/meetnote-server-base:latest

WORKDIR /app

# Application code only (changes frequently, small layer)
COPY . .

# Default environment variables
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
ENV HF_HUB_ENABLE_XET=0
ENV SMTP_HOST=smtp.gmail.com
ENV SMTP_PORT=587
ENV SMTP_USE_TLS=true

RUN useradd -m appuser && \
    mkdir -p /app/data/recordings && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8765

CMD ["python", "server.py"]
