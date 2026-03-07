#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="/app/models"

# RealESRGAN General Model
GENERAL_URL="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
GENERAL_FILE="${MODEL_DIR}/RealESRGAN_x4plus.pth"

# RealESRGAN Anime/2D Art Model
ANIME_URL="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.2.4/RealESRGAN_x4plus_anime_6B.pth"
ANIME_FILE="${MODEL_DIR}/RealESRGAN_x4plus_anime_6B.pth"

mkdir -p "${MODEL_DIR}"

if [ ! -f "${GENERAL_FILE}" ]; then
    echo ">>> Downloading RealESRGAN_x4plus.pth (General)..."
    wget -q --show-progress -O "${GENERAL_FILE}" "${GENERAL_URL}"
else
    echo ">>> General model already present: ${GENERAL_FILE}"
fi

if [ ! -f "${ANIME_FILE}" ]; then
    echo ">>> Downloading RealESRGAN_x4plus_anime_6B.pth (2D Art/Logo)..."
    wget -q --show-progress -O "${ANIME_FILE}" "${ANIME_URL}"
else
    echo ">>> Anime model already present: ${ANIME_FILE}"
fi

echo ">>> All models downloaded."
