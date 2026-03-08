"""
Real-ESRGAN model loader and inference wrapper.
Uses the RealESRGANer class from the realesrgan library.
"""

import os
import numpy as np
import torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

# Defaults
GENERAL_MODEL_PATH = os.getenv("ESRGAN_MODEL_PATH", "/app/models/RealESRGAN_x4plus.pth")
ANIME_MODEL_PATH = os.getenv("ESRGAN_ANIME_MODEL_PATH", "/app/models/RealESRGAN_x4plus_anime_6B.pth")

# Singleton state mapping model name -> upsampler instance
_upsamplers = {}

def _get_device():
    """Detect if CUDA or MPS is available, else fallback to CPU."""
    if torch.cuda.is_available():
        return torch.device('cuda')
    elif torch.backends.mps.is_available():
        return torch.device('mps')
    else:
        return torch.device('cpu')


def get_upsampler(model_type="general") -> RealESRGANer:
    """Lazy-load the Real-ESRGAN model (singleton per model_type)."""
    global _upsamplers
    if model_type in _upsamplers:
        return _upsamplers[model_type]

    device = _get_device()
    
    if model_type == "anime":
        model_path = ANIME_MODEL_PATH
        print(f"[esrgan] Loading RealESRGAN_x4plus_anime_6B on {device}...")
        # The anime model uses a 6-block RRDBNet config
        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=6,
            num_grow_ch=32,
            scale=4,
        )
    else:
        model_path = GENERAL_MODEL_PATH
        print(f"[esrgan] Loading RealESRGAN_x4plus on {device}...")
        # General model uses 23 blocks
        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=23,
            num_grow_ch=32,
            scale=4,
        )

    _upsamplers[model_type] = RealESRGANer(
        scale=4,
        model_path=model_path,
        dni_weight=None,
        model=model,
        tile=0,           # 0 = no tiling; increase if OOM
        tile_pad=10,
        pre_pad=0,
        half=False,        # fp32 for CPU compatibility
        device=device,
    )

    print(f"[esrgan] {model_type} Model loaded successfully.")
    return _upsamplers[model_type]


def upscale(image_bgr: np.ndarray, model_type="general") -> np.ndarray:
    """
    Upscale a BGR numpy image by 4× using Real-ESRGAN.
    """
    upsampler = get_upsampler(model_type)
    output, _ = upsampler.enhance(image_bgr, outscale=4)
    return output
