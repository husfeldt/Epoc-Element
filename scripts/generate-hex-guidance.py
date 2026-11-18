import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), "hex_guidance")
os.makedirs(OUT_DIR, exist_ok=True)


def make_hex_points(cx: float, cy: float, radius: float, y_scale: float):
    pts = []
    for i in range(6):
        ang = math.radians(60 * i - 30)
        pts.append((cx + radius * math.cos(ang), cy + radius * math.sin(ang) * y_scale))
    return pts


def build_guidance_pair(
    name: str,
    base_rgb=(118, 128, 78),
    edge_rgb=(86, 94, 58),
    y_scale=0.65,
    radius=410.0,
    cy=620.0,
):
    size = 1024
    cx = size * 0.5
    pts = make_hex_points(cx, cy, radius, y_scale)

    # 1. Guidance RGB image: pure #FFFFFF studio outside, 6-sided shaded hex base inside
    img = Image.new("RGB", (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Flat, seamless 6-sided ground plane (NO 3D rim/bevel so ComfyUI doesn't paint a coaster slab)
    draw.polygon(pts, fill=base_rgb)

    # Subtle top-left directional highlight inside the hex
    arr = np.array(img, dtype=np.float32)
    yy, xx = np.mgrid[0:size, 0:size]
    # Only modulate non-white pixels
    inside = np.any(arr < 250, axis=2)
    grad = ((cx - xx) / radius * 0.5 + (cy - yy) / (radius * y_scale) * 0.5) * 18.0
    arr[inside] = np.clip(arr[inside] + grad[inside, None], 0, 255)
    img = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    img_path = os.path.join(OUT_DIR, f"{name}_guidance.png")
    img.save(img_path)

    # 2. Latent noise mask: white (255) where ComfyUI may paint (inside 6-sided hex + upper 2.5D headroom),
    # black (0) on outer corners so ComfyUI keeps pure #FFFFFF outside the 6-sided hex!
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.polygon(make_hex_points(cx, cy, radius * 0.995, y_scale), fill=255)
    # Smooth 2.5D headroom arch above the hex (tall enough for peaks, tight enough to avoid white voids)
    half_w = radius * math.sqrt(3) * 0.5 * 0.90
    top_y = cy - radius * 0.5 * y_scale
    mdraw.polygon(
        [
            (cx - half_w, top_y),
            (cx - half_w * 0.78, cy - radius * 0.85),
            (cx - half_w * 0.40, cy - radius * 1.08),
            (cx, cy - radius * 1.18),
            (cx + half_w * 0.40, cy - radius * 1.08),
            (cx + half_w * 0.78, cy - radius * 0.85),
            (cx + half_w, top_y),
        ],
        fill=255,
    )
    mask_path = os.path.join(OUT_DIR, f"{name}_mask.png")
    mask.save(mask_path)

    print(f"Generated {img_path} and {mask_path}")


def hex_center_offset(q: int, r: int, radius: float, y_scale: float):
    x = radius * math.sqrt(3) * (q + r * 0.5)
    y = radius * 1.5 * r * y_scale
    return x, y


def build_multihex_guidance_pair(
    name: str,
    offsets,
    base_rgb=(110, 124, 70),
    y_scale=0.65,
    radius=165.0,
    cy=620.0,
):
    size = 1024
    cx = size * 0.5
    img = Image.new("RGB", (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Center offsets around (0,0) horizontally
    xs = [hex_center_offset(q, r, radius, y_scale)[0] for q, r in offsets]
    ys = [hex_center_offset(q, r, radius, y_scale)[1] for q, r in offsets]
    avg_x = sum(xs) / len(xs)
    avg_y = sum(ys) / len(ys)

    centers = [(cx + x - avg_x, cy + y - avg_y) for x, y in zip(xs, ys)]
    for hx, hy in centers:
        draw.polygon(make_hex_points(hx, hy, radius, y_scale), fill=base_rgb)

    arr = np.array(img, dtype=np.float32)
    yy, xx = np.mgrid[0:size, 0:size]
    inside = np.any(arr < 250, axis=2)
    grad = ((cx - xx) / (radius * 2.5) * 0.5 + (cy - yy) / (radius * 2.0 * y_scale) * 0.5) * 14.0
    arr[inside] = np.clip(arr[inside] + grad[inside, None], 0, 254)
    img = Image.fromarray(arr.astype(np.uint8), mode="RGB")
    img_path = os.path.join(OUT_DIR, f"{name}_guidance.png")
    img.save(img_path)

    # Crisp binary mask: union of all hexes + smooth upper headroom arch aligned to top-row hexes
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    for hx, hy in centers:
        pts = make_hex_points(hx, hy, radius * 0.995, y_scale)
        mdraw.polygon(pts, fill=255)

    # Arch spans only the top-most row's outer edges so middle rows never get notched
    min_hy = min(hy for _, hy in centers)
    top_row = [(hx, hy) for hx, hy in centers if abs(hy - min_hy) < 5.0]
    min_x = min(hx for hx, _ in top_row) - radius * math.sqrt(3) * 0.46
    max_x = max(hx for hx, _ in top_row) + radius * math.sqrt(3) * 0.46
    base_top_y = min_hy - radius * 0.45 * y_scale
    arch_peak_y = max(28.0, min_hy - radius * 1.28)
    mdraw.polygon(
        [
            (min_x, base_top_y),
            (min_x + (max_x - min_x) * 0.14, arch_peak_y + radius * 0.36),
            (min_x + (max_x - min_x) * 0.32, arch_peak_y + radius * 0.10),
            (cx, arch_peak_y),
            (min_x + (max_x - min_x) * 0.68, arch_peak_y + radius * 0.10),
            (min_x + (max_x - min_x) * 0.86, arch_peak_y + radius * 0.36),
            (max_x, base_top_y),
        ],
        fill=255,
    )
    mask_path = os.path.join(OUT_DIR, f"{name}_mask.png")
    mask.save(mask_path)
    print(f"Generated {img_path} and {mask_path}")


if __name__ == "__main__":
    build_guidance_pair("hex_iso_temperate", base_rgb=(110, 124, 70), edge_rgb=(110, 124, 70))
    build_guidance_pair("hex_iso_mountain", base_rgb=(116, 120, 114), edge_rgb=(116, 120, 114))
    build_guidance_pair("hex_iso_desert", base_rgb=(182, 148, 100), edge_rgb=(182, 148, 100))
    build_guidance_pair("hex_iso_arctic", base_rgb=(196, 208, 220), edge_rgb=(196, 208, 220))
    build_guidance_pair("hex_iso_coast", base_rgb=(40, 96, 112), edge_rgb=(40, 96, 112))

    # Multi-hex 2x1 (2 adjacent hexes)
    for bname, rgb in [
        ("temperate", (110, 124, 70)),
        ("mountain", (116, 120, 114)),
        ("desert", (182, 148, 100)),
        ("arctic", (196, 208, 220)),
        ("coast", (40, 96, 112)),
    ]:
        build_multihex_guidance_pair(f"hex_2x1_{bname}", [(0, 0), (1, 0)], base_rgb=rgb, radius=245.0, cy=610.0)

    # Multi-hex 3x1 (3 hexes in a row)
    for bname, rgb in [
        ("temperate", (110, 124, 70)),
        ("mountain", (116, 120, 114)),
        ("desert", (182, 148, 100)),
    ]:
        build_multihex_guidance_pair(f"hex_3x1_{bname}", [(-1, 0), (0, 0), (1, 0)], base_rgb=rgb, radius=165.0, cy=610.0)

    # Multi-hex 7-hex flower (center + 6 axial neighbors)
    seven = [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)]
    for bname, rgb in [
        ("temperate", (110, 124, 70)),
        ("mountain", (116, 120, 114)),
        ("desert", (182, 148, 100)),
        ("arctic", (196, 208, 220)),
    ]:
        build_multihex_guidance_pair(f"hex_7hex_{bname}", seven, base_rgb=rgb, radius=165.0, cy=580.0)
