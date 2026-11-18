import json
import os
import numpy as np
from PIL import Image
from cutout_sprite import cutout_and_trim

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DIR = os.path.join(ROOT, "scripts", ".raw_comfy")
SPRITES_DIR = os.path.join(ROOT, "public", "assets", "sprites")
MANIFEST_PATH = os.path.join(SPRITES_DIR, "manifest.json")

SNOW_KEYWORDS = ("arctic", "snow", "ice", "city", "sand_cay")


def is_snow_asset(sprite_id: str, category: str) -> bool:
    s = f"{sprite_id} {category}".lower()
    return any(k in s for k in SNOW_KEYWORDS)


def clean_existing_rgba(path: str, interior_key: bool):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    sat = np.max(rgb, axis=2) - np.min(rgb, axis=2)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]

    if interior_key:
        interior_white = (rgb[:, :, 0] > 228.0) & (rgb[:, :, 1] > 228.0) & (rgb[:, :, 2] > 228.0) & (sat < 20.0)
        alpha = np.where(interior_white, 0.0, alpha)

    bg_mask = alpha < 24.0
    padded_bg = np.pad(bg_mask, 1, mode="constant", constant_values=True)
    near_bg = (
        padded_bg[:-2, 1:-1]
        | padded_bg[2:, 1:-1]
        | padded_bg[1:-1, :-2]
        | padded_bg[1:-1, 2:]
    ) & (~bg_mask)

    fringe = near_bg & (lum > 182.0) & (sat < 28.0)
    opaque_core = (~bg_mask) & (~fringe) & (alpha > 200.0)
    rgb_sum = np.zeros_like(rgb)
    cnt_sum = np.zeros((h, w), dtype=np.float32)
    padded_rgb = np.pad(rgb * opaque_core[:, :, None], ((1, 1), (1, 1), (0, 0)), mode="constant")
    padded_cnt = np.pad(opaque_core.astype(np.float32), 1, mode="constant")
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            rgb_sum += padded_rgb[1 + dy : h + 1 + dy, 1 + dx : w + 1 + dx, :]
            cnt_sum += padded_cnt[1 + dy : h + 1 + dy, 1 + dx : w + 1 + dx]

    has_neighbor = cnt_sum > 0.5
    neighbor_rgb = rgb_sum / np.maximum(1.0, cnt_sum[:, :, None])
    rgb = np.where((fringe & has_neighbor)[:, :, None], neighbor_rgb, rgb)

    out_arr = np.zeros((h, w, 4), dtype=np.uint8)
    out_arr[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out_arr[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    Image.fromarray(out_arr, mode="RGBA").save(path, format="PNG", optimize=True)


def main():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    cleaned_raw = 0
    cleaned_rgba = 0
    for entry in manifest.get("sprites", []):
        sid = entry["id"]
        cat = entry.get("category", "")
        fname = os.path.basename(entry["file"])
        out_path = os.path.join(SPRITES_DIR, fname)
        raw_path = os.path.join(RAW_DIR, f"{sid}.png")

        use_interior = not is_snow_asset(sid, cat)
        if os.path.exists(raw_path) and ("forest" in sid or "jungle" in sid or use_interior):
            # Re-cutout from raw ComfyUI image with interior white key + 1px color decontamination
            t_width = int(entry.get("width", 240))
            if t_width < 220:
                t_width = 240
            cutout_and_trim(raw_path, out_path, target_width=t_width, interior_key=use_interior)
            cleaned_raw += 1
        elif os.path.exists(out_path) and use_interior:
            clean_existing_rgba(out_path, interior_key=True)
            cleaned_rgba += 1

    print(f"Cleaned {cleaned_raw} sprites from raw ComfyUI + {cleaned_rgba} existing RGBA sprites.")


if __name__ == "__main__":
    main()
