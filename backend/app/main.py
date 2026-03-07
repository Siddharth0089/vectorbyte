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

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job storage for SVG results (for export endpoint)
_svg_store: dict[str, str] = {}


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


def _parse_config(settings_json: str | None, k_colors: int = 12) -> PipelineConfig:
    """Parse pipeline config from JSON string or use defaults."""
    if settings_json:
        try:
            data = json.loads(settings_json)
            return PipelineConfig(
                detail_level=data.get("detail_level", "medium"),
                color_count=data.get("color_count", k_colors),
                auto_colors=data.get("auto_colors", True),
                input_quality=data.get("input_quality", "medium"),
                edge_smoothness=data.get("edge_smoothness", 50),
                noise_tolerance=data.get("noise_tolerance", 50),
                enable_superres=data.get("enable_superres", True),
                filter_speckle=data.get("filter_speckle"),
                corner_threshold=data.get("corner_threshold"),
                length_threshold=data.get("length_threshold"),
                splice_threshold=data.get("splice_threshold"),
                path_precision=data.get("path_precision"),
                color_precision=data.get("color_precision"),
                layer_difference=data.get("layer_difference"),
                max_iterations=data.get("max_iterations"),
            )
        except (json.JSONDecodeError, TypeError) as e:
            print(f"[api] Warning: invalid settings JSON, using defaults: {e}")

    return PipelineConfig(color_count=k_colors)


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

    # If auto_colors is True and no explicit override, run analyzer
    if config.auto_colors and settings is None:
        analyzer = ImageAnalyzer(image_bgr)
        analysis = analyzer.analyze()
        config.color_count = analysis["recommended_settings"]["color_count"]
        config.detail_level = analysis["recommended_settings"]["detail_level"]
        config.input_quality = analysis["recommended_settings"]["input_quality"]
        config.edge_smoothness = analysis["recommended_settings"]["edge_smoothness"]
        config.noise_tolerance = analysis["recommended_settings"]["noise_tolerance"]
        config.enable_superres = analysis["recommended_settings"]["enable_superres"]

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
    _svg_store[job_id] = svg_string

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
    if job_id and job_id in _svg_store:
        svg_content = _svg_store[job_id]
    elif svg:
        svg_content = svg
    else:
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

            # Auto-detect per image if enabled
            file_config = PipelineConfig(**config.to_dict())  # copy
            if file_config.auto_colors:
                analyzer = ImageAnalyzer(image_bgr)
                analysis = analyzer.analyze()
                rec = analysis["recommended_settings"]
                file_config.color_count = rec["color_count"]
                file_config.detail_level = rec["detail_level"]
                file_config.input_quality = rec["input_quality"]
                file_config.edge_smoothness = rec["edge_smoothness"]
                file_config.noise_tolerance = rec["noise_tolerance"]
                file_config.enable_superres = rec["enable_superres"]

            svg_string = run_pipeline(image_bgr, config=file_config)

            job_id = uuid.uuid4().hex
            _svg_store[job_id] = svg_string

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
