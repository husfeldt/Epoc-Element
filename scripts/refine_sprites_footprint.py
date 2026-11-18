import glob
import json
import os
import numpy as np
from PIL import Image

SPRITES_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "sprites")
MANIFEST_PATH = os.path.join(SPRITES_DIR, "manifest.json")


def refine_sprite(path: str, footprint: str):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape

    # Identify pixels in the lower 42% of the sprite (where square/isometric slab skirts live)
    # Apply a smooth elliptical ground-hugging alpha mask in the lower half so square corners
    # and vertical cliff-wall bases dissolve seamlessly into the procedural ground!
    yy, xx = np.mgrid[0:h, 0:w]
    cx = (w - 1) * 0.5
    cy = h * 0.60

    # Tighter ground-hugging oval so square diorama slab corners are completely removed
    rx = w * (0.40 if footprint == "1x1" else 0.44)
    ry = h * 0.27
    dx = (xx - cx) / max(1.0, rx)
    dy = (yy - cy) / max(1.0, ry)
    ell_dist = np.sqrt(dx * dx + dy * dy)

    lower_t = np.clip((yy - h * 0.40) / (h * 0.22), 0.0, 1.0)
    ell_fade = np.clip((1.02 - ell_dist) / 0.26, 0.0, 1.0)
    bottom_cut = np.clip((h * 0.90 - yy) / (h * 0.10), 0.0, 1.0)

    mask = (1.0 - lower_t) + lower_t * ell_fade
    mask = mask * np.where(yy > h * 0.68, bottom_cut, 1.0)

    arr[:, :, 3] = np.clip(arr[:, :, 3] * mask, 0, 255)

    # Re-trim any newly empty rows/cols
    fg_ys, fg_xs = np.where(arr[:, :, 3] > 16)
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
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    for entry in manifest.get("sprites", []):
        fname = os.path.basename(entry["file"])
        fpath = os.path.join(SPRITES_DIR, fname)
        if not os.path.exists(fpath):
            continue
        nw, nh = refine_sprite(fpath, entry.get("footprint", "1x1"))
        entry["width"] = nw
        entry["height"] = nh
        entry["anchorX"] = 0.5
        entry["anchorY"] = 0.66

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Refined {len(manifest.get('sprites', []))} sprites for seamless hex alignment.")


if __name__ == "__main__":
    main()
