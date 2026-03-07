"""
Advanced raster-to-vector processing pipeline with auto-detection.

Stages:
  1. AI Super-Resolution   (Real-ESRGAN x4)
  2. Noise Reduction        (Bilateral Filter — configurable)
  3. Color Quantization     (K-Means Clustering — configurable)
  4. Vectorization          (vtracer — configurable)
  5. SVG Optimization       (SVGO via Node CLI)

Includes ImageAnalyzer for automatic optimal settings detection and
PipelineConfig for full user control over every parameter.
"""

import subprocess
import tempfile
import os
import json
from dataclasses import dataclass, field, asdict
from typing import Optional, Literal

import cv2
import numpy as np
from PIL import Image
import vtracer

from app.esrgan import upscale


# ---------------------------------------------------------------------------
# Pipeline Configuration
# ---------------------------------------------------------------------------
@dataclass
class PipelineConfig:
    """All tuneable parameters for the R2V pipeline."""

    # --- Detail level ---
    detail_level: Literal["high", "medium", "low"] = "medium"

    # --- Color quantization ---
    color_count: int = 12               # 2–64
    auto_colors: bool = True            # use auto-detected count

    # --- Input quality (affects super-res + denoising) ---
    input_quality: Literal["low", "medium", "high"] = "medium"

    # --- Edge smoothness (0–100) ---
    edge_smoothness: int = 50

    # --- Noise tolerance (0–100): higher = more noise rejection ---
    noise_tolerance: int = 50

    # --- Super-resolution toggle ---
    enable_superres: bool = True

    # --- Expert Overrides (Phase 6 Advanced Features) ---
    image_profile: Literal["auto", "photo", "logo", "pixel_art"] = "auto"
    ai_model: Literal["general", "anime"] = "general"
    tracing_engine: Literal["vtracer", "potrace"] = "vtracer"
    clustering_method: Literal["kmeans", "mean_shift"] = "kmeans"

    # --- Advanced vtracer overrides (None = auto from detail_level) ---
    filter_speckle: Optional[int] = None
    corner_threshold: Optional[int] = None
    length_threshold: Optional[float] = None
    splice_threshold: Optional[int] = None
    path_precision: Optional[int] = None
    color_precision: Optional[int] = None
    layer_difference: Optional[int] = None
    max_iterations: Optional[int] = None

    def to_dict(self):
        return asdict(self)


# ---------------------------------------------------------------------------
# Image Analyzer — auto-detect optimal settings
# ---------------------------------------------------------------------------
class ImageAnalyzer:
    """Analyzes a raster image to recommend optimal pipeline settings."""

    def __init__(self, image_bgr: np.ndarray):
        self.image = image_bgr
        self.h, self.w = image_bgr.shape[:2]
        self.gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    def analyze(self) -> dict:
        """Run full analysis and return recommended settings + diagnostics."""
        color_count = self._detect_color_count()
        detail_level = self._detect_detail_level()
        input_quality = self._detect_input_quality()
        edge_smoothness = self._detect_edge_smoothness()
        noise_level = self._estimate_noise_level()
        noise_tolerance = self._noise_to_tolerance(noise_level)
        is_logo = self._detect_is_logo(color_count)
        is_photo = self._detect_is_photo(color_count)
        is_pixel_art = self._detect_is_pixel_art(color_count)

        image_type = "artwork/illustration"
        if is_pixel_art:
            image_type = "pixel_art"
        elif is_logo:
            image_type = "logo/icon"
        elif is_photo:
            image_type = "photograph"

        return {
            "recommended_settings": {
                "detail_level": detail_level,
                "color_count": color_count,
                "input_quality": input_quality,
                "edge_smoothness": edge_smoothness if not is_pixel_art else 0,
                "noise_tolerance": noise_tolerance if not is_pixel_art else 0,
                "enable_superres": input_quality != "high" and not is_pixel_art,
                "image_profile": "pixel_art" if is_pixel_art else "auto",
                "ai_model": "anime" if is_logo and not is_pixel_art else "general",
            },
            "diagnostics": {
                "image_width": self.w,
                "image_height": self.h,
                "total_pixels": self.w * self.h,
                "detected_colors": color_count,
                "detail_score": round(self._laplacian_variance(), 2),
                "noise_level": round(noise_level, 2),
                "edge_density": round(self._edge_density(), 4),
                "is_logo_or_icon": is_logo,
                "is_photograph": is_photo,
                "is_pixel_art": is_pixel_art,
                "image_type": image_type,
            },
        }

    def _detect_color_count(self) -> int:
        """Estimate optimal color count from histogram peaks."""
        # Resize for speed
        small = cv2.resize(self.image, (200, 200)) if self.w > 200 else self.image
        pixels = small.reshape(-1, 3).astype(np.float32)

        # Try K-Means with increasing K, find elbow
        prev_compactness = None
        best_k = 8
        for k in [4, 6, 8, 12, 16, 24, 32]:
            criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1.0)
            compactness, _, _ = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
            if prev_compactness is not None:
                improvement = (prev_compactness - compactness) / prev_compactness
                if improvement < 0.08:  # diminishing returns
                    best_k = k
                    break
            prev_compactness = compactness
            best_k = k

        # Also check unique colors in quantized space
        quantized = (small // 32) * 32  # rough quantization
        unique_colors = len(np.unique(quantized.reshape(-1, 3), axis=0))

        if unique_colors <= 6:
            return min(unique_colors + 2, best_k)
        return min(best_k, 32)

    def _laplacian_variance(self) -> float:
        """Measure image sharpness/detail via Laplacian variance."""
        lap = cv2.Laplacian(self.gray, cv2.CV_64F)
        return float(lap.var())

    def _detect_detail_level(self) -> str:
        """Classify detail level from Laplacian variance."""
        var = self._laplacian_variance()
        if var > 500:
            return "high"
        elif var > 100:
            return "medium"
        return "low"

    def _detect_input_quality(self) -> str:
        """Assess if the image is pixelated, medium, or high quality."""
        # Check resolution
        total_pixels = self.w * self.h

        # Edge sharpness test — pixelated images have very sharp, staircase edges
        edges = cv2.Canny(self.gray, 50, 150)
        edge_ratio = np.count_nonzero(edges) / edges.size

        # Small + lots of hard edges = likely pixelated
        if total_pixels < 100 * 100 or (total_pixels < 300 * 300 and edge_ratio > 0.15):
            return "low"
        elif total_pixels < 800 * 800:
            return "medium"
        return "high"

    def _detect_edge_smoothness(self) -> int:
        """Recommend edge smoothness 0–100."""
        edges = cv2.Canny(self.gray, 50, 150)
        density = np.count_nonzero(edges) / edges.size

        # Dense edges = complex, keep detail (lower smoothness)
        # Sparse edges = simple shapes, smooth more
        if density > 0.15:
            return 25
        elif density > 0.08:
            return 50
        return 75

    def _edge_density(self) -> float:
        edges = cv2.Canny(self.gray, 50, 150)
        return float(np.count_nonzero(edges) / edges.size)

    def _estimate_noise_level(self) -> float:
        """Estimate noise using the median absolute deviation of the Laplacian."""
        lap = cv2.Laplacian(self.gray, cv2.CV_64F)
        sigma = float(np.median(np.abs(lap)) / 0.6745)
        return sigma

    def _noise_to_tolerance(self, noise: float) -> int:
        """Map noise level to tolerance 0–100."""
        if noise > 20:
            return 80
        elif noise > 10:
            return 60
        elif noise > 5:
            return 40
        return 20

    def _detect_is_logo(self, color_count: int) -> bool:
        """Heuristic: logo = few colors + relatively small + simple shapes."""
        return color_count <= 8 and self.w * self.h < 1000 * 1000

    def _detect_is_photo(self, color_count: int) -> bool:
        """Heuristic: photos tend to have high color count + gradients."""
        return color_count >= 16

    def _detect_is_pixel_art(self, color_count: int) -> bool:
        """
        Heuristic: Pixel art typically consists of exactly solid color blocks
        with no anti-aliasing. If downscaling with nearest-neighbor and then
        upscaling back perfectly matches the original, it's likely pixel art
        or simple rasterized low-res graphics.
        """
        # Pixel art is usually tiny or has very few colors
        if self.w * self.h > 1000 * 1000 or color_count > 32:
            return False
            
        # Try a quick resize comparison to detect blockiness
        # If we shrink to 1/4th and scale back up via nearest-neighbor, 
        # does it look nearly identical to the original?
        small = cv2.resize(self.gray, (self.w // 4, self.h // 4), interpolation=cv2.INTER_NEAREST)
        reconstructed = cv2.resize(small, (self.w, self.h), interpolation=cv2.INTER_NEAREST)
        
        diff = cv2.absdiff(self.gray, reconstructed)
        mean_diff = np.mean(diff)
        
        return mean_diff < 5.0  # Very tight threshold for perfect grid blockiness


# ---------------------------------------------------------------------------
# Stage 1 — AI Super-Resolution (Real-ESRGAN x4) / Pixel Art Upscale
# ---------------------------------------------------------------------------
def stage_superres(image_bgr: np.ndarray, config: PipelineConfig) -> np.ndarray:
    """Upscale image 4×. Bypasses ESRGAN for pixel art to preserve grid."""
    
    # 4x Exact Nearest-Neighbor for Pixel Art (preserves hard squares)
    if config.image_profile == "pixel_art":
        h, w = image_bgr.shape[:2]
        print("[pipeline] Pixel Art mode: Using 4x Nearest-Neighbor interpolation")
        return cv2.resize(image_bgr, (w * 4, h * 4), interpolation=cv2.INTER_NEAREST)
        
    if not config.enable_superres:
        print("[pipeline] Skipping super-resolution (disabled)")
        return image_bgr
        
    return upscale(image_bgr, model_type=config.ai_model)


# ---------------------------------------------------------------------------
# Stage 2 — Bilateral Filter (Noise Reduction)
# ---------------------------------------------------------------------------
def stage_bilateral(image_bgr: np.ndarray, config: PipelineConfig) -> np.ndarray:
    """
    Smooth flat areas while preserving edges.
    Parameters adapt to noise_tolerance and edge_smoothness.
    """
    # Map noise_tolerance (0-100) to sigma values
    sigma_color = 30 + int(config.noise_tolerance * 1.2)   # 30–150
    sigma_space = 30 + int(config.edge_smoothness * 1.2)    # 30–150

    # More iterations for higher smoothness
    d = 5 if config.edge_smoothness < 30 else (9 if config.edge_smoothness < 70 else 13)

    result = cv2.bilateralFilter(image_bgr, d=d, sigmaColor=sigma_color, sigmaSpace=sigma_space)

    # Apply additional smoothing pass for low-quality pixelated inputs
    if config.input_quality == "low":
        result = cv2.bilateralFilter(result, d=d, sigmaColor=sigma_color, sigmaSpace=sigma_space)

    return result


# ---------------------------------------------------------------------------
# Stage 3 — Color Quantization (K-Means or Mean-Shift)
# ---------------------------------------------------------------------------
def stage_quantize(image_bgr: np.ndarray, config: PipelineConfig) -> np.ndarray:
    """
    Reduce colors using selected clustering method.
    """
    # 1. Mean-Shift Clustering (Accurate spatial grouping, preserves thin lines)
    if config.clustering_method == "mean_shift":
        sp = 10  # Spatial window radius
        sr = 40  # Color window radius
        # Mean shift smooths and quantizes simultaneously
        shifted = cv2.pyrMeanShiftFiltering(image_bgr, sp, sr, maxLevel=1)
        # We still run a quick k-means on top of the shifted image to enforce the exact color_count
        image_bgr = shifted

    # 2. K-Means Clustering
    k = config.color_count
    h, w, c = image_bgr.shape
    pixel_values = np.float32(image_bgr.reshape(-1, 3))

    # More iterations for higher quality
    max_iter = {
        "low": 50,
        "medium": 100,
        "high": 200,
    }.get(config.detail_level, 100)

    criteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        max_iter,
        0.1,
    )

    attempts = 5 if config.detail_level == "low" else 10

    _, labels, centers = cv2.kmeans(
        pixel_values,
        k,
        None,
        criteria,
        attempts,
        cv2.KMEANS_PP_CENTERS,
    )

    centers = np.uint8(centers)
    quantized = centers[labels.flatten()]
    return quantized.reshape(h, w, c)


# ---------------------------------------------------------------------------
# Stage 4 — Vectorization (vtracer)
# ---------------------------------------------------------------------------
def _get_vtracer_params(config: PipelineConfig) -> dict:
    """Build vtracer parameters from PipelineConfig."""
    # Base presets by detail level
    presets = {
        "high": {
            "filter_speckle": 2,
            "color_precision": 8,
            "layer_difference": 8,
            "corner_threshold": 45,
            "length_threshold": 2.0,
            "max_iterations": 15,
            "splice_threshold": 30,
            "path_precision": 3,
        },
        "medium": {
            "filter_speckle": 4,
            "color_precision": 6,
            "layer_difference": 16,
            "corner_threshold": 60,
            "length_threshold": 4.0,
            "max_iterations": 10,
            "splice_threshold": 45,
            "path_precision": 2,
        },
        "low": {
            "filter_speckle": 8,
            "color_precision": 4,
            "layer_difference": 24,
            "corner_threshold": 90,
            "length_threshold": 6.0,
            "max_iterations": 8,
            "splice_threshold": 60,
            "path_precision": 2,
        },
    }

    params = presets.get(config.detail_level, presets["medium"]).copy()

    # Apply edge smoothness adjustment to corner/splice thresholds
    smoothness_factor = config.edge_smoothness / 50.0  # 0–2 range
    params["corner_threshold"] = int(params["corner_threshold"] * smoothness_factor)
    params["corner_threshold"] = max(10, min(180, params["corner_threshold"]))
    params["splice_threshold"] = int(params["splice_threshold"] * smoothness_factor)
    params["splice_threshold"] = max(10, min(180, params["splice_threshold"]))

    # Apply noise tolerance to filter_speckle
    noise_factor = config.noise_tolerance / 50.0
    params["filter_speckle"] = max(1, int(params["filter_speckle"] * noise_factor))

    # User overrides
    for key in ["filter_speckle", "corner_threshold", "length_threshold",
                "splice_threshold", "path_precision", "color_precision",
                "layer_difference", "max_iterations"]:
        user_val = getattr(config, key, None)
        if user_val is not None:
            params[key] = user_val

    return params


def stage_vectorize(image_bgr: np.ndarray, config: PipelineConfig) -> str:
    """
    Convert the processed image to an SVG string via vtracer or potrace.
    """
    if config.tracing_engine == "potrace":
        return _vectorize_potrace(image_bgr)
        
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(image_rgb)

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = tmp.name
        pil_img.save(tmp_path, format="PNG")

    params = _get_vtracer_params(config)

    try:
        svg_str = vtracer.convert_image_to_svg_py(
            tmp_path,
            colormode="color",
            hierarchical="stacked",
            mode="spline",
            **params,
        )
    finally:
        os.unlink(tmp_path)

    return svg_str

def _vectorize_potrace(image_bgr: np.ndarray) -> str:
    """
    Uses the potrace CLI to generate mathematically perfect B&W bezier curves.
    Best for high-contrast logos or line-art.
    """
    # Convert to grayscale then strict binary threshold
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    
    with tempfile.NamedTemporaryFile(suffix=".bmp", delete=False) as bmp_tmp, \
         tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as svg_tmp:
         
        cv2.imwrite(bmp_tmp.name, binary)
        bmp_path = bmp_tmp.name
        svg_path = svg_tmp.name
        
    try:
        # Run potrace: --svg output format, --cleartext removes fills from white areas
        cmd = ["potrace", bmp_path, "--svg", "--cleartext", "--output", svg_path]
        subprocess.run(cmd, check=True, capture_output=True)
        
        with open(svg_path, "r", encoding="utf-8") as f:
            svg_str = f.read()
    except subprocess.CalledProcessError as e:
        print(f"[potrace] Error: {e.stderr.decode()}")
        svg_str = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50">Potrace Error</text></svg>'
    finally:
        os.unlink(bmp_path)
        os.unlink(svg_path)
        
    return svg_str


# ---------------------------------------------------------------------------
# Stage 5 — SVGO Optimization
# ---------------------------------------------------------------------------
def stage_svgo(raw_svg: str) -> str:
    """
    Pipe the raw SVG through SVGO for path merging,
    redundant-node removal, and XML minification.
    """
    try:
        result = subprocess.run(
            ["svgo", "--input", "-", "--output", "-"],
            input=raw_svg,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout
        print(f"[svgo] Warning: SVGO returned code {result.returncode}")
        if result.stderr:
            print(f"[svgo] stderr: {result.stderr[:500]}")
        return raw_svg
    except FileNotFoundError:
        print("[svgo] Warning: svgo binary not found, skipping optimization")
        return raw_svg
    except subprocess.TimeoutExpired:
        print("[svgo] Warning: SVGO timed out, skipping optimization")
        return raw_svg


# ---------------------------------------------------------------------------
# Quantized Preview (for real-time feedback)
# ---------------------------------------------------------------------------
def get_quantized_preview(image_bgr: np.ndarray, config: PipelineConfig) -> bytes:
    """Return a JPEG-encoded preview of the quantized image (stages 2+3 only)."""
    img = stage_bilateral(image_bgr, config)
    img = stage_quantize(img, config)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb)

    import io
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Full Pipeline
# ---------------------------------------------------------------------------
def run_pipeline(
    image_bgr: np.ndarray,
    config: Optional[PipelineConfig] = None,
    k_colors: int = 12,
) -> str:
    """
    Execute the complete 5-stage R2V pipeline.
    Returns the optimized SVG string.

    If no config is provided, uses defaults with the given k_colors.
    """
    if config is None:
        config = PipelineConfig(color_count=k_colors)

    print(f"[pipeline] Config: detail={config.detail_level}, colors={config.color_count}, "
          f"quality={config.input_quality}, smoothness={config.edge_smoothness}, "
          f"noise_tol={config.noise_tolerance}")

    print("[pipeline] Stage 1/5 — AI Super-Resolution (Real-ESRGAN x4)...")
    img = stage_superres(image_bgr, config)

    print("[pipeline] Stage 2/5 — Bilateral Filter...")
    img = stage_bilateral(img, config)

    print(f"[pipeline] Stage 3/5 — K-Means Color Quantization (K={config.color_count})...")
    img = stage_quantize(img, config)

    print("[pipeline] Stage 4/5 — Vectorization (vtracer)...")
    raw_svg = stage_vectorize(img, config)

    print("[pipeline] Stage 5/5 — SVGO Optimization...")
    optimized_svg = stage_svgo(raw_svg)

    print("[pipeline] ✓ Pipeline complete.")
    return optimized_svg
