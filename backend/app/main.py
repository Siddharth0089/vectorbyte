"""
FastAPI application — Advanced Raster-to-Vector service.

Endpoints:
  POST /api/vectorize       — upload an image with settings, receive optimized SVG
  POST /api/analyze         — upload an image, receive auto-detected settings
  POST /api/export          — convert SVG to PDF/EPS/DXF
  POST /api/vectorize/batch — batch-process multiple images
  GET  /api/uploads/{f}     — serve the original upload for before/after view
  GET  /api/health          — liveness check
"""

import os
import uuid
import traceback
import json
import io
import time
from collections import OrderedDict

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

from app.pipeline import run_pipeline, PipelineConfig, ImageAnalyzer, get_quantized_preview
from app.export import export_svg, get_export_mime_type, get_export_extension, SUPPORTED_FORMATS

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="VectorForge — Advanced R2V API", version="2.0.0")

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# CORS — allow frontend origin (production & dev)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
if not CORS_ORIGINS:
    CORS_ORIGINS = ["*"]
ALLOW_CREDENTIALS = "*" not in CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job storage for SVG results (for export endpoint)
MAX_STORED_SVGS = int(os.environ.get("MAX_STORED_SVGS", "200"))
SVG_TTL_SECONDS = int(os.environ.get("SVG_TTL_SECONDS", "3600"))
_svg_store: OrderedDict[str, tuple[str, float]] = OrderedDict()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _validate_and_read_image(file: UploadFile, contents: bytes):
    """Validate file extension and decode image."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {ALLOWED_EXTENSIONS}",
        )
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 20 MB limit.")

    nparr = np.frombuffer(contents, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    return image_bgr, ext


def _save_original(contents: bytes, ext: str) -> str:
    """Save uploaded image and return filename."""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(save_path, "wb") as f:
        f.write(contents)
    return unique_name


def _as_int(value, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    """Parse and clamp integer input."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _as_float(value, default: float, minimum: float | None = None, maximum: float | None = None) -> float:
    """Parse and clamp float input."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def _as_bool(value, default: bool) -> bool:
    """Parse bool-like values from JSON forms."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
        return default
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _parse_config(settings_json: str | None, k_colors: int = 12) -> PipelineConfig:
    """Parse pipeline config from JSON string or use defaults."""
    if settings_json:
        try:
            data = json.loads(settings_json)
            return PipelineConfig(
                detail_level=data.get("detail_level", "medium"),
                color_count=_as_int(data.get("color_count", k_colors), k_colors, minimum=2, maximum=64),
                auto_colors=_as_bool(data.get("auto_colors", True), True),
                input_quality=data.get("input_quality", "medium"),
                edge_smoothness=_as_int(data.get("edge_smoothness", 50), 50, minimum=0, maximum=100),
                noise_tolerance=_as_int(data.get("noise_tolerance", 50), 50, minimum=0, maximum=100),
                enable_superres=_as_bool(data.get("enable_superres", True), True),
                image_profile=data.get("image_profile", "auto"),
                ai_model=data.get("ai_model", "general"),
                tracing_engine=data.get("tracing_engine", "vtracer"),
                clustering_method=data.get("clustering_method", "kmeans"),
                filter_speckle=_as_int(data.get("filter_speckle"), 4, minimum=1, maximum=50) if data.get("filter_speckle") is not None else None,
                corner_threshold=_as_int(data.get("corner_threshold"), 60, minimum=10, maximum=180) if data.get("corner_threshold") is not None else None,
                length_threshold=_as_float(data.get("length_threshold"), 4.0, minimum=0.5, maximum=20.0) if data.get("length_threshold") is not None else None,
                splice_threshold=_as_int(data.get("splice_threshold"), 45, minimum=10, maximum=180) if data.get("splice_threshold") is not None else None,
                path_precision=_as_int(data.get("path_precision"), 2, minimum=1, maximum=8) if data.get("path_precision") is not None else None,
                color_precision=_as_int(data.get("color_precision"), 6, minimum=1, maximum=10) if data.get("color_precision") is not None else None,
                layer_difference=_as_int(data.get("layer_difference"), 16, minimum=1, maximum=64) if data.get("layer_difference") is not None else None,
                max_iterations=_as_int(data.get("max_iterations"), 10, minimum=1, maximum=30) if data.get("max_iterations") is not None else None,
            )
        except (json.JSONDecodeError, TypeError) as e:
            print(f"[api] Warning: invalid settings JSON, using defaults: {e}")

    return PipelineConfig(color_count=k_colors)


def _apply_analysis_recommendations(config: PipelineConfig, analysis: dict, *, full_auto: bool) -> None:
    """Apply analyzer recommendations to pipeline config."""
    rec = analysis.get("recommended_settings", {})

    if config.auto_colors:
        config.color_count = rec.get("color_count", config.color_count)

    # If the request had no explicit settings, apply all recommended defaults.
    if full_auto:
        config.detail_level = rec.get("detail_level", config.detail_level)
        config.input_quality = rec.get("input_quality", config.input_quality)
        config.edge_smoothness = rec.get("edge_smoothness", config.edge_smoothness)
        config.noise_tolerance = rec.get("noise_tolerance", config.noise_tolerance)
        config.enable_superres = rec.get("enable_superres", config.enable_superres)

    # Keep automatic profile/model behavior available even with manual settings.
    if config.image_profile == "auto":
        config.image_profile = rec.get("image_profile", config.image_profile)
    if config.ai_model == "general" and rec.get("ai_model") == "anime":
        config.ai_model = "anime"


def _cleanup_svg_store(now: float | None = None) -> None:
    """Drop expired SVG results from the in-memory store."""
    ts = now if now is not None else time.time()
    expired_ids = [
        job_id for job_id, (_, created_at) in _svg_store.items()
        if ts - created_at > SVG_TTL_SECONDS
    ]
    for job_id in expired_ids:
        _svg_store.pop(job_id, None)


def _store_svg(job_id: str, svg: str) -> None:
    """Store an SVG result with TTL + max-size eviction."""
    now = time.time()
    _cleanup_svg_store(now)
    _svg_store[job_id] = (svg, now)
    _svg_store.move_to_end(job_id)
    while len(_svg_store) > MAX_STORED_SVGS:
        _svg_store.popitem(last=False)


def _get_stored_svg(job_id: str) -> str | None:
    """Get a stored SVG by job id (refreshes TTL on access)."""
    now = time.time()
    _cleanup_svg_store(now)
    item = _svg_store.get(job_id)
    if item is None:
        return None

    svg, _ = item
    _svg_store[job_id] = (svg, now)
    _svg_store.move_to_end(job_id)
    return svg


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/api/analyze")
async def analyze_image(
    file: UploadFile = File(...),
):
    """
    Analyze an uploaded image and return auto-detected optimal settings.
    Does NOT run the full pipeline — just the analysis.
    """
    contents = await file.read()
    image_bgr, ext = _validate_and_read_image(file, contents)

    # Save original for preview
    unique_name = _save_original(contents, ext)

    # Run analysis
    analyzer = ImageAnalyzer(image_bgr)
    analysis = analyzer.analyze()

    return JSONResponse(content={
        "analysis": analysis,
        "original_url": f"/api/uploads/{unique_name}",
        "filename": file.filename,
    })


@app.post("/api/vectorize")
async def vectorize(
    file: UploadFile = File(...),
    k_colors: int = Form(default=12),
    settings: str = Form(default=None),
):
    """
    Accept an uploaded raster image, run the 5-stage R2V pipeline,
    and return the SVG string plus a URL to the original upload.

    Settings can be a JSON string with pipeline configuration.
    """
    contents = await file.read()
    image_bgr, ext = _validate_and_read_image(file, contents)

    # Save original for before/after
    unique_name = _save_original(contents, ext)

    # Parse config
    config = _parse_config(settings, k_colors)

    # Run analyzer for full-auto requests and for auto profile/color controls.
    if settings is None or config.auto_colors or config.image_profile == "auto":
        analyzer = ImageAnalyzer(image_bgr)
        analysis = analyzer.analyze()
        _apply_analysis_recommendations(config, analysis, full_auto=settings is None)

    # Run pipeline
    try:
        svg_string = run_pipeline(image_bgr, config=config)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline error: {str(exc)}",
        )

    # Store SVG for export endpoint
    job_id = uuid.uuid4().hex
    _store_svg(job_id, svg_string)

    return JSONResponse(content={
        "svg": svg_string,
        "original_url": f"/api/uploads/{unique_name}",
        "job_id": job_id,
        "config_used": config.to_dict(),
    })


@app.post("/api/export")
async def export_vector(
    job_id: str = Form(default=None),
    svg: str = Form(default=None),
    format: str = Form(default="svg"),
):
    """
    Export a vectorized result to a different format.
    Either provide a job_id from a previous vectorize call, or pass the SVG directly.
    """
    fmt = format.lower()
    if fmt not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{fmt}'. Supported: {SUPPORTED_FORMATS}",
        )

    # Get SVG content
    svg_content = None
    if job_id:
        svg_content = _get_stored_svg(job_id)
    if svg_content is None and svg:
        svg_content = svg
    if svg_content is None:
        raise HTTPException(
            status_code=400,
            detail="Provide either a valid job_id or svg content.",
        )

    try:
        result_bytes = export_svg(svg_content, fmt)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Export error: {str(exc)}",
        )

    mime_type = get_export_mime_type(fmt)
    extension = get_export_extension(fmt)

    return StreamingResponse(
        io.BytesIO(result_bytes),
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="vectorized{extension}"',
        },
    )


@app.post("/api/vectorize/batch")
async def vectorize_batch(
    files: list[UploadFile] = File(...),
    settings: str = Form(default=None),
):
    """
    Batch-process multiple images. Returns results for each file.
    """
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per batch.")

    config = _parse_config(settings)
    results = []

    for file in files:
        try:
            contents = await file.read()
            image_bgr, ext = _validate_and_read_image(file, contents)
            unique_name = _save_original(contents, ext)

            # Auto-detect per image when requested/needed.
            file_config = PipelineConfig(**config.to_dict())  # copy
            if settings is None or file_config.auto_colors or file_config.image_profile == "auto":
                analyzer = ImageAnalyzer(image_bgr)
                analysis = analyzer.analyze()
                _apply_analysis_recommendations(file_config, analysis, full_auto=settings is None)

            svg_string = run_pipeline(image_bgr, config=file_config)

            job_id = uuid.uuid4().hex
            _store_svg(job_id, svg_string)

            results.append({
                "filename": file.filename,
                "status": "success",
                "svg": svg_string,
                "original_url": f"/api/uploads/{unique_name}",
                "job_id": job_id,
            })
        except Exception as exc:
            traceback.print_exc()
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(exc),
            })

    return JSONResponse(content={"results": results})


@app.post("/api/preview/quantized")
async def preview_quantized(
    file: UploadFile = File(...),
    settings: str = Form(default=None),
):
    """
    Get a quick preview of color quantization result (stages 2+3 only).
    Returns a JPEG image.
    """
    contents = await file.read()
    image_bgr, ext = _validate_and_read_image(file, contents)
    config = _parse_config(settings)

    try:
        preview_bytes = get_quantized_preview(image_bgr, config)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Preview error: {str(exc)}")

    return StreamingResponse(
        io.BytesIO(preview_bytes),
        media_type="image/jpeg",
    )


@app.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve an uploaded original image."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(file_path)
