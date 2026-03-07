"""
Multi-format export module.

Converts SVG strings to:
  - PDF  (via cairosvg)
  - EPS  (via cairosvg → PS conversion)
  - DXF  (via ezdxf with SVG path parsing)
"""

import io
import re
import math
from typing import Literal

import cairosvg
import ezdxf
from xml.etree import ElementTree as ET


ExportFormat = Literal["svg", "pdf", "eps", "dxf"]

SUPPORTED_FORMATS = {"svg", "pdf", "eps", "dxf"}


def export_svg(svg_string: str, fmt: ExportFormat) -> bytes:
    """
    Convert an SVG string to the requested format.
    Returns raw bytes of the output file.
    """
    if fmt == "svg":
        return svg_string.encode("utf-8")
    elif fmt == "pdf":
        return _svg_to_pdf(svg_string)
    elif fmt == "eps":
        return _svg_to_eps(svg_string)
    elif fmt == "dxf":
        return _svg_to_dxf(svg_string)
    else:
        raise ValueError(f"Unsupported format: {fmt}. Supported: {SUPPORTED_FORMATS}")


def _svg_to_pdf(svg_string: str) -> bytes:
    """Convert SVG to PDF using cairosvg."""
    return cairosvg.svg2pdf(bytestring=svg_string.encode("utf-8"))


def _svg_to_eps(svg_string: str) -> bytes:
    """Convert SVG to EPS using cairosvg (via PostScript)."""
    return cairosvg.svg2ps(bytestring=svg_string.encode("utf-8"))


def _svg_to_dxf(svg_string: str) -> bytes:
    """
    Convert SVG paths to DXF polylines using ezdxf.
    Parses SVG path data and converts to DXF entities.
    """
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()

    try:
        root = ET.fromstring(svg_string)
    except ET.ParseError:
        # If SVG parsing fails, return an empty DXF
        buf = io.BytesIO()
        doc.write(buf)
        return buf.getvalue()

    # Get SVG viewBox dimensions for coordinate mapping
    viewbox = root.get("viewBox", "")
    vb_parts = viewbox.split() if viewbox else []
    vb_height = float(vb_parts[3]) if len(vb_parts) >= 4 else 100.0

    ns = {"svg": "http://www.w3.org/2000/svg"}

    # Find all path elements (with and without namespace)
    paths = root.findall(".//{http://www.w3.org/2000/svg}path")
    paths += root.findall(".//path")

    for path_elem in paths:
        d = path_elem.get("d", "")
        if not d:
            continue

        fill = path_elem.get("fill", "#000000")
        color_idx = _hex_to_aci(fill)

        # Parse SVG path commands to points
        points = _parse_svg_path_to_points(d, vb_height)

        if len(points) >= 2:
            try:
                msp.add_lwpolyline(
                    points,
                    dxfattribs={"color": color_idx},
                    close=True,
                )
            except Exception:
                # Skip malformed paths
                pass

    buf = io.BytesIO()
    doc.write(buf)
    return buf.getvalue()


def _parse_svg_path_to_points(d: str, vb_height: float) -> list:
    """
    Parse SVG path 'd' attribute into a list of (x, y) points.
    Handles M, L, C, Q, Z commands (simplified — curves become endpoints).
    Y coordinates are flipped for DXF (DXF Y goes up, SVG Y goes down).
    """
    points = []
    # Tokenize: split commands and numbers
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?', d)

    cx, cy = 0.0, 0.0  # current position
    i = 0

    while i < len(tokens):
        cmd = tokens[i]
        if not cmd.isalpha():
            i += 1
            continue
        i += 1

        if cmd in ('M', 'm'):
            # Move to
            if i + 1 < len(tokens):
                try:
                    x, y = float(tokens[i]), float(tokens[i + 1])
                    if cmd == 'm':
                        x += cx
                        y += cy
                    cx, cy = x, y
                    points.append((cx, vb_height - cy))
                    i += 2
                except (ValueError, IndexError):
                    i += 1
            # Subsequent coordinate pairs are implicit LineTo
            while i + 1 < len(tokens) and not tokens[i].isalpha():
                try:
                    x, y = float(tokens[i]), float(tokens[i + 1])
                    if cmd == 'm':
                        x += cx
                        y += cy
                    cx, cy = x, y
                    points.append((cx, vb_height - cy))
                    i += 2
                except (ValueError, IndexError):
                    break

        elif cmd in ('L', 'l'):
            while i + 1 < len(tokens) and not tokens[i].isalpha():
                try:
                    x, y = float(tokens[i]), float(tokens[i + 1])
                    if cmd == 'l':
                        x += cx
                        y += cy
                    cx, cy = x, y
                    points.append((cx, vb_height - cy))
                    i += 2
                except (ValueError, IndexError):
                    break

        elif cmd == 'H':
            if i < len(tokens) and not tokens[i].isalpha():
                cx = float(tokens[i])
                points.append((cx, vb_height - cy))
                i += 1

        elif cmd == 'h':
            if i < len(tokens) and not tokens[i].isalpha():
                cx += float(tokens[i])
                points.append((cx, vb_height - cy))
                i += 1

        elif cmd == 'V':
            if i < len(tokens) and not tokens[i].isalpha():
                cy = float(tokens[i])
                points.append((cx, vb_height - cy))
                i += 1

        elif cmd == 'v':
            if i < len(tokens) and not tokens[i].isalpha():
                cy += float(tokens[i])
                points.append((cx, vb_height - cy))
                i += 1

        elif cmd in ('C', 'c'):
            # Cubic bezier — take endpoint only
            while i + 5 < len(tokens) and not tokens[i].isalpha():
                try:
                    vals = [float(tokens[i + j]) for j in range(6)]
                    if cmd == 'c':
                        cx += vals[4]
                        cy += vals[5]
                    else:
                        cx, cy = vals[4], vals[5]
                    points.append((cx, vb_height - cy))
                    i += 6
                except (ValueError, IndexError):
                    break

        elif cmd in ('Q', 'q'):
            # Quadratic bezier — take endpoint only
            while i + 3 < len(tokens) and not tokens[i].isalpha():
                try:
                    vals = [float(tokens[i + j]) for j in range(4)]
                    if cmd == 'q':
                        cx += vals[2]
                        cy += vals[3]
                    else:
                        cx, cy = vals[2], vals[3]
                    points.append((cx, vb_height - cy))
                    i += 4
                except (ValueError, IndexError):
                    break

        elif cmd in ('S', 's'):
            while i + 3 < len(tokens) and not tokens[i].isalpha():
                try:
                    vals = [float(tokens[i + j]) for j in range(4)]
                    if cmd == 's':
                        cx += vals[2]
                        cy += vals[3]
                    else:
                        cx, cy = vals[2], vals[3]
                    points.append((cx, vb_height - cy))
                    i += 4
                except (ValueError, IndexError):
                    break

        elif cmd in ('T', 't'):
            while i + 1 < len(tokens) and not tokens[i].isalpha():
                try:
                    x, y = float(tokens[i]), float(tokens[i + 1])
                    if cmd == 't':
                        x += cx
                        y += cy
                    cx, cy = x, y
                    points.append((cx, vb_height - cy))
                    i += 2
                except (ValueError, IndexError):
                    break

        elif cmd in ('A', 'a'):
            # Arc — simplified: take endpoint
            while i + 6 < len(tokens) and not tokens[i].isalpha():
                try:
                    x = float(tokens[i + 5])
                    y = float(tokens[i + 6])
                    if cmd == 'a':
                        x += cx
                        y += cy
                    cx, cy = x, y
                    points.append((cx, vb_height - cy))
                    i += 7
                except (ValueError, IndexError):
                    break

        elif cmd in ('Z', 'z'):
            # Close path - add first point again
            if points:
                points.append(points[0])

    return points


def _hex_to_aci(hex_color: str) -> int:
    """Convert hex color to closest AutoCAD Color Index (ACI) value."""
    if not hex_color or hex_color == "none":
        return 7  # white

    hex_color = hex_color.lstrip("#")
    if len(hex_color) < 6:
        return 7

    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
    except ValueError:
        return 7

    # Simplified ACI mapping (basic 7 colors)
    aci_colors = [
        (255, 0, 0, 1),      # red
        (255, 255, 0, 2),    # yellow
        (0, 255, 0, 3),      # green
        (0, 255, 255, 4),    # cyan
        (0, 0, 255, 5),      # blue
        (255, 0, 255, 6),    # magenta
        (255, 255, 255, 7),  # white
        (128, 128, 128, 8),  # gray
        (0, 0, 0, 0),        # black (by layer)
    ]

    min_dist = float("inf")
    closest = 7
    for cr, cg, cb, idx in aci_colors:
        dist = math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2)
        if dist < min_dist:
            min_dist = dist
            closest = idx

    return closest


def get_export_mime_type(fmt: ExportFormat) -> str:
    """Return the MIME type for a given export format."""
    return {
        "svg": "image/svg+xml",
        "pdf": "application/pdf",
        "eps": "application/postscript",
        "dxf": "application/dxf",
    }.get(fmt, "application/octet-stream")


def get_export_extension(fmt: ExportFormat) -> str:
    """Return the file extension for a given export format."""
    return f".{fmt}"
