FROM python:3.11-slim

WORKDIR /app

# System dependencies for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies (cached unless requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download models (cached as Docker layer, ~3GB)
# This avoids runtime download issues in restricted networks
# Uninstall hf-xet to force standard HTTP downloads
ENV HF_HUB_ENABLE_XET=0
RUN pip uninstall -y hf-xet 2>/dev/null; \
    python -c "\
from faster_whisper import WhisperModel; \
print('Downloading Whisper large-v3-turbo...'); \
WhisperModel('large-v3-turbo', device='cpu', compute_type='int8'); \
print('Whisper model ready.')"

RUN python -c "\
from pyannote.audio import Pipeline; \
print('Downloading pyannote community-1...'); \
Pipeline.from_pretrained('pyannote/speaker-diarization-community-1'); \
print('Pyannote model ready.')"

RUN python -c "\
from pyannote.audio import Model; \
print('Downloading wespeaker embedding model...'); \
Model.from_pretrained('pyannote/wespeaker-voxceleb-resnet34-LM'); \
print('Embedding model ready.')"

# Application code (changes frequently, small layer)
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
