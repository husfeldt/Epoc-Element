import json
import os
import shutil
import numpy as np
from PIL import Image

SPRITES_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "sprites")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "scripts", ".sprite_backups")
MANIFEST_PATH = os.path.join(SPRITES_DIR, "manifest.json")


def _value_noise_2d(yy: np.ndarray, xx: np.ndarray, freq: float, seed: int) -> np.ndarray:
    """Fast deterministic 2D value noise for organic radial perimeter erosion."""
    gx = xx * freq + (seed % 97) * 1.7
    gy = yy * freq + (seed % 53) * 2.3
    x0 = np.floor(gx).astype(np.int32)
    y0 = np.floor(gy).astype(np.int32)
    tx = gx - x0
    ty = gy - y0
    ux = tx * tx * (3.0 - 2.0 * tx)
    uy = ty * ty * (3.0 - 2.0 * ty)

    def h(ix, iy):
        ix64 = ix.astype(np.int64)
        iy64 = iy.astype(np.int64)
        n = (ix64 * 374761393 + iy64 * 668265263 + np.int64(seed) * 1442695041) & 0x7FFFFFFF
        n = ((n ^ (n >> 13)) * 1274126177) & 0x7FFFFFFF
        return ((n ^ (n >> 16)) & 0xFFFF).astype(np.float32) / 65535.0

    v00 = h(x0, y0)
    v10 = h(x0 + 1, y0)
    v01 = h(x0, y0 + 1)
    v11 = h(x0 + 1, y0 + 1)
    nx0 = v00 + (v10 - v00) * ux
    nx1 = v01 + (v11 - v01) * ux
    return nx0 + (nx1 - nx0) * uy


def blend_sprite_skirt(path: str, footprint: str, seed: int = 101):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape

    yy, xx = np.mgrid[0:h, 0:w]
    cx = (w - 1) * 0.5
    cy = h * 0.58

    # Bottom-Only Alpha Feathering (preserve 100% crisp, solid alpha silhouettes on upper 90%)
    # Apply soft alpha feathering ONLY along the bottom 10% ground-contact line.
    n1 = _value_noise_2d(yy, xx, 0.06, seed)
    bottom_noise = (n1 - 0.5) * 0.025 * h
    bottom_fade = np.clip((h * 0.99 - yy + bottom_noise) / (h * 0.10), 0.0, 1.0)
    mask = np.where(yy > h * 0.89, bottom_fade, 1.0)
    arr[:, :, 3] = np.clip(arr[:, :, 3] * mask, 0, 255)

    # Color-harmonize bottom-most skirt pixels: slightly desaturate & normalize luminance
    # so bright yellow-green diorama grass pads blend into olive/ochre ground tiles
    skirt_t = np.clip((yy - h * 0.62) / (h * 0.24), 0.0, 1.0)
    if np.any(skirt_t > 0):
        rgb = arr[:, :, :3]
        lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
        # Blend 40% toward muted neutral earth luminance at the very bottom skirt
        desat_factor = 1.0 - 0.42 * skirt_t[:, :, None]
        lum_norm = lum[:, :, None] * (1.0 - 0.12 * skirt_t[:, :, None])
        arr[:, :, :3] = np.clip(lum_norm + (rgb - lum[:, :, None]) * desat_factor, 0, 255)

    fg_ys, fg_xs = np.where(arr[:, :, 3] > 14)
    if len(fg_xs) > 0 and len(fg_ys) > 0:
        x0 = max(0, int(fg_xs.min()) - 1)
        y0 = max(0, int(fg_ys.min()) - 1)
        x1 = min(w, int(fg_xs.max()) + 2)
        y1 = min(h, int(fg_ys.max()) + 2)
        arr = arr[y0:y1, x0:x1]

    out = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
    out.save(path, format="PNG", optimize=True)
    return out.width, out.height


def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    count = 0
    for entry in manifest.get("sprites", []):
        fname = os.path.basename(entry["file"])
        fpath = os.path.join(SPRITES_DIR, fname)
        if not os.path.exists(fpath):
            continue
        bpath = os.path.join(BACKUP_DIR, fname)
        if not os.path.exists(bpath):
            shutil.copy2(fpath, bpath)

        nw, nh = blend_sprite_skirt(fpath, entry.get("footprint", "1x1"), seed=101 + count * 37)
        entry["width"] = nw
        entry["height"] = nh
        entry["anchorX"] = 0.5
        entry["anchorY"] = 0.66
        count += 1

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Blended and harmonized {count} sprites in manifest.json.")


if __name__ == "__main__":
    main()
