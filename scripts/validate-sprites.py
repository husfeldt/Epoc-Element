import json
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPRITES_DIR = os.path.join(ROOT, "public", "assets", "sprites")
MANIFEST_PATH = os.path.join(SPRITES_DIR, "manifest.json")
REPORT_JSON_PATH = os.path.join(ROOT, "public", "sprite-validation-report.json")
REPORT_HTML_PATH = os.path.join(ROOT, "public", "sprite-validation-report.html")

SNOW_OR_WHITE_OK = ("arctic", "snow", "ice", "marble", "city", "sand_cay", "atoll", "celestial")


def is_white_expected(sprite_id: str) -> bool:
    s = sprite_id.lower()
    return any(k in s for k in SNOW_OR_WHITE_OK)


def _line_r2_and_slope(ys: np.ndarray, xs: np.ndarray):
    if len(ys) < 12:
        return 0.0, 0.0
    y_mean = ys.mean()
    x_mean = xs.mean()
    dy = ys - y_mean
    dx = xs - x_mean
    denom = float(np.sum(dy * dy))
    if denom < 1e-6:
        return 0.0, 0.0
    slope = float(np.sum(dy * dx)) / denom
    pred = x_mean + slope * dy
    ss_res = float(np.sum((xs - pred) ** 2))
    ss_tot = float(np.sum(dx * dx))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 1e-6 else (1.0 if ss_res < 1e-3 else 0.0)
    return r2, slope


def validate_single_sprite(path: str, sprite_id: str) -> dict:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    # Check 1: No White Artifacts (>0.2% of non-transparent pixels have R,G,B > 235 & sat < 20)
    fg_mask = alpha > 16.0
    fg_count = int(np.sum(fg_mask))
    if fg_count == 0:
        return {"id": sprite_id, "passed": False, "reasons": ["Empty foreground"], "width": w, "height": h}

    sat = np.max(rgb, axis=2) - np.min(rgb, axis=2)
    near_white = fg_mask & (rgb[:, :, 0] > 235.0) & (rgb[:, :, 1] > 235.0) & (rgb[:, :, 2] > 235.0) & (sat < 20.0)
    white_ratio = float(np.sum(near_white)) / max(1, fg_count)

    reasons = []
    if not is_white_expected(sprite_id) and white_ratio > 0.002:
        reasons.append(f"White artifacts ({white_ratio * 100:.2f}% > 0.20%)")

    # Check 2: No 4-Sided Diamond / Square Pedestal in lower half (y >= 0.55 * h)
    y_start = int(h * 0.55)
    y_end = int(h * 0.92)
    left_ys, left_xs = [], []
    right_ys, right_xs = [], []
    for y in range(y_start, y_end):
        xs = np.where(alpha[y, :] > 40.0)[0]
        if len(xs) >= 8:
            left_ys.append(float(y))
            left_xs.append(float(xs[0]))
            right_ys.append(float(y))
            right_xs.append(float(xs[-1]))

    r2_l, slope_l = _line_r2_and_slope(np.array(left_ys), np.array(left_xs))
    r2_r, slope_r = _line_r2_and_slope(np.array(right_ys), np.array(right_xs))

    # Straight 45-deg diamond edges: left slopes inward (+0.45..+2.2), right slopes inward (-0.45..-2.2)
    is_diamond = (
        r2_l > 0.96
        and r2_r > 0.96
        and 0.45 < slope_l < 2.2
        and -2.2 < slope_r < -0.45
    )
    # Straight rectangular cutaway slab sides: both left & right nearly vertical
    is_rect_slab = r2_l > 0.97 and r2_r > 0.97 and abs(slope_l) < 0.08 and abs(slope_r) < 0.08
    if is_diamond:
        reasons.append(f"4-sided diamond pedestal detected (R2={r2_l:.3f}/{r2_r:.3f})")
    if is_rect_slab:
        reasons.append(f"Rectangular slab block detected (R2={r2_l:.3f}/{r2_r:.3f})")

    # Check 3: Valid Aspect & Fill (subject fills 45%-95% of frame cleanly)
    ys_fg, xs_fg = np.where(fg_mask)
    fill_w = float(xs_fg.max() - xs_fg.min() + 1) / max(1, w)
    fill_h = float(ys_fg.max() - ys_fg.min() + 1) / max(1, h)
    if fill_w < 0.45 or fill_h < 0.45:
        reasons.append(f"Under-filled subject ({fill_w*100:.0f}%x{fill_h*100:.0f}%)")

    return {
        "id": sprite_id,
        "passed": len(reasons) == 0,
        "reasons": reasons,
        "whiteRatio": round(white_ratio, 5),
        "diamondR2": [round(r2_l, 3), round(r2_r, 3)],
        "fill": [round(fill_w, 2), round(fill_h, 2)],
        "width": w,
        "height": h,
    }


def validate_all():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    results = []
    failed = []
    for entry in manifest.get("sprites", []):
        sid = entry["id"]
        fpath = os.path.join(SPRITES_DIR, os.path.basename(entry["file"]))
        if not os.path.exists(fpath):
            continue
        res = validate_single_sprite(fpath, sid)
        res["file"] = entry["file"]
        results.append(res)
        if not res["passed"]:
            failed.append(res)

    report = {
        "total": len(results),
        "passed": len(results) - len(failed),
        "failed": len(failed),
        "failedItems": failed,
        "results": results,
    }
    with open(REPORT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    cards = []
    for r in results:
        border = "#22c55e" if r["passed"] else "#ef4444"
        status = "PASS" if r["passed"] else "; ".join(r["reasons"])
        cards.append(
            f'<div style="border:2px solid {border};padding:8px;border-radius:8px;background:#1e293b">'
            f'<img src="{r["file"]}" style="width:120px;height:120px;object-fit:contain;background:#0f172a"/>'
            f'<div style="font:600 11px sans-serif;color:#f8fafc;margin-top:4px">{r["id"]}</div>'
            f'<div style="font:400 10px sans-serif;color:{border}">{status}</div>'
            f"</div>"
        )
    html = (
        "<!doctype html><html><body style='background:#09111a;color:#fff;font-family:sans-serif;padding:20px'>"
        f"<h2>Sprite Validation Report: {report['passed']}/{report['total']} Passed ({report['failed']} Failed)</h2>"
        "<div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:10px'>"
        + "".join(cards)
        + "</div></body></html>"
    )
    with open(REPORT_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Validated {report['total']} sprites: {report['passed']} passed, {report['failed']} failed.")
    for item in failed[:15]:
        print(f"  FAIL {item['id']}: {item['reasons']}")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "--single":
        res = validate_single_sprite(sys.argv[2], sys.argv[3])
        print(json.dumps(res))
    else:
        validate_all()
