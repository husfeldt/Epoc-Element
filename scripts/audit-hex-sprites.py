import os
import json
import numpy as np
from PIL import Image

MANIFEST = os.path.join("public", "assets", "sprites", "manifest.json")
with open(MANIFEST, "r", encoding="utf-8") as f:
    data = json.load(f)

bad = []
for s in data["sprites"]:
    if not s.get("hexTile"):
        continue
    fp = os.path.join("public", s["file"].lstrip("/"))
    if not os.path.exists(fp):
        bad.append((s["id"], "missing"))
        continue
    im = Image.open(fp).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape
    a = arr[:, :, 3] > 20
    rgb = arr[:, :, :3]
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    sat = np.max(rgb, axis=2) - np.min(rgb, axis=2)

    # Check 1: Bright white/grey pixels in upper 40% or outer 15%
    upper = np.zeros_like(a)
    upper[: int(h * 0.40), :] = True
    white_upper = np.sum(a & upper & (lum > 215) & (sat < 22)) / max(1, np.sum(a))

    # Check 2: Top-row flat clipping (many opaque pixels touching y=0 or y=1)
    top_clip = np.sum(a[:2, :]) / max(1, w * 2)

    # Check 3: Side-edge flat clipping in upper 35% (indicates mask-chopped peak/tree)
    side_clip = (np.sum(a[: int(h * 0.35), :2]) + np.sum(a[: int(h * 0.35), -2:])) / max(1, int(h * 0.35) * 4)

    reasons = []
    if white_upper > 0.03:
        reasons.append(f"white_upper={white_upper:.2f}")
    if top_clip > 0.25:
        reasons.append(f"top_clip={top_clip:.2f}")
    if side_clip > 0.25:
        reasons.append(f"side_clip={side_clip:.2f}")

    if reasons:
        bad.append((s["id"], s.get("footprint", "1x1"), ", ".join(reasons)))

print(f"Audited hexTiles: {len(bad)} flagged:")
for item in bad:
    print(" ", item)
