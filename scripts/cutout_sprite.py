import sys
import json
from collections import deque
from PIL import Image
import numpy as np


def cutout_and_trim(in_path: str, out_path: str, target_width: int = 280, interior_key: bool = False):
    im = Image.open(in_path).convert("RGBA")
    arr = np.array(im, dtype=np.float32)
    h, w, _ = arr.shape

    # Sample corner pixels to estimate exact studio white background
    corners = np.array([arr[2, 2, :3], arr[2, w - 3, :3], arr[h - 3, 2, :3], arr[h - 3, w - 3, :3]])
    bg_rgb = np.median(corners, axis=0)

    rgb = arr[:, :, :3]
    dist_bg = np.linalg.norm(rgb - bg_rgb, axis=2)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    sat = np.max(rgb, axis=2) - np.min(rgb, axis=2)

    is_bg_cand = (dist_bg < 56.0) | ((lum > 220.0) & (sat < 22.0))

    # Border-connected flood fill
    bg_mask = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        if is_bg_cand[0, x]:
            bg_mask[0, x] = True
            q.append((0, x))
        if is_bg_cand[h - 1, x]:
            bg_mask[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if is_bg_cand[y, 0]:
            bg_mask[y, 0] = True
            q.append((y, 0))
        if is_bg_cand[y, w - 1]:
            bg_mask[y, w - 1] = True
            q.append((y, w - 1))

    while q:
        cy, cx = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not bg_mask[ny, nx] and is_bg_cand[ny, nx]:
                bg_mask[ny, nx] = True
                q.append((ny, nx))

    # Global near-white interior chroma-key for foliage/non-snow assets
    # Eliminates all white pockets trapped between tree trunks, palm fronds, and branches
    if interior_key:
        upper_zone = np.zeros((h, w), dtype=bool)
        upper_zone[: int(h * 0.58), :] = True
        interior_white = (
            ((rgb[:, :, 0] > 205.0) & (rgb[:, :, 1] > 205.0) & (rgb[:, :, 2] > 205.0) & (sat < 26.0))
            | ((dist_bg < 54.0) & (sat < 26.0))
            | (upper_zone & (lum > 172.0) & (sat < 18.0))
        )
        bg_mask = bg_mask | interior_white

    # Remove disconnected tiny foreground islands (< 1.5% of total foreground area)
    # Eliminates 1px VAE mask border dots and stray floating tree/leaf slivers
    fg = ~bg_mask
    total_fg = int(np.sum(fg))
    if total_fg > 0:
        visited = np.zeros((h, w), dtype=bool)
        min_island = max(200, int(total_fg * 0.015))
        ys, xs = np.where(fg)
        for sy, sx in zip(ys.tolist(), xs.tolist()):
            if visited[sy, sx]:
                continue
            comp = []
            cq = deque([(sy, sx)])
            visited[sy, sx] = True
            while cq:
                cy, cx = cq.popleft()
                comp.append((cy, cx))
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        cq.append((ny, nx))
            if len(comp) < min_island:
                for cy, cx in comp:
                    bg_mask[cy, cx] = True

    # 1px thin-line / whisker removal (eliminates 1px VAE mask outline dots)
    for _ in range(2):
        p = np.pad(~bg_mask, 1, mode="constant", constant_values=False)
        n4 = p[:-2, 1:-1].astype(np.int32) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        bg_mask = bg_mask | ((~bg_mask) & (n4 <= 1))

    alpha = np.where(bg_mask, 0.0, 255.0)

    # 2px edge feathering & white-halo color decontamination
    padded_bg = np.pad(bg_mask, 2, mode="constant", constant_values=True)
    near_bg_1 = (
        padded_bg[1:-3, 2:-2]
        | padded_bg[3:-1, 2:-2]
        | padded_bg[2:-2, 1:-3]
        | padded_bg[2:-2, 3:-1]
    ) & (~bg_mask)
    near_bg_2 = (
        padded_bg[:-4, 2:-2]
        | padded_bg[4:, 2:-2]
        | padded_bg[2:-2, :-4]
        | padded_bg[2:-2, 4:]
    ) & (~bg_mask)
    near_bg = near_bg_1 | near_bg_2

    fringe = near_bg & (dist_bg < 88.0) & (lum > 170.0)
    t_fringe = np.clip((dist_bg - 26.0) / 56.0, 0.05, 1.0)
    alpha = np.where(fringe, t_fringe * 255.0, alpha)

    # 2px edge color-decontamination pass: replace bright fringe RGB on semi-transparent pixels
    # with the nearest opaque interior pixel's RGB so white outlines are physically impossible
    opaque_core = (~bg_mask) & (~fringe) & (alpha >= 250.0)
    rgb_sum = np.zeros_like(rgb)
    cnt_sum = np.zeros((h, w), dtype=np.float32)
    padded_rgb = np.pad(rgb * opaque_core[:, :, None], ((2, 2), (2, 2), (0, 0)), mode="constant")
    padded_cnt = np.pad(opaque_core.astype(np.float32), 2, mode="constant")
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            if dy == 0 and dx == 0:
                continue
            rgb_sum += padded_rgb[2 + dy : h + 2 + dy, 2 + dx : w + 2 + dx, :]
            cnt_sum += padded_cnt[2 + dy : h + 2 + dy, 2 + dx : w + 2 + dx]

    has_neighbor = cnt_sum > 0.5
    neighbor_rgb = rgb_sum / np.maximum(1.0, cnt_sum[:, :, None])
    replace_mask = ((alpha > 0.0) & (alpha < 255.0)) | (fringe & has_neighbor)
    decontam = np.where((replace_mask & has_neighbor)[:, :, None], neighbor_rgb, rgb)

    out_arr = np.zeros((h, w, 4), dtype=np.uint8)
    out_arr[:, :, :3] = decontam.astype(np.uint8)
    out_arr[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)

    # Auto-trim transparent padding
    fg_ys, fg_xs = np.where(out_arr[:, :, 3] > 24)
    if len(fg_xs) == 0 or len(fg_ys) == 0:
        raise RuntimeError(f"Empty foreground after cutout for {in_path}")

    x0 = max(0, int(fg_xs.min()) - 2)
    y0 = max(0, int(fg_ys.min()) - 2)
    x1 = min(w, int(fg_xs.max()) + 3)
    y1 = min(h, int(fg_ys.max()) + 3)

    cropped = Image.fromarray(out_arr[y0:y1, x0:x1], mode="RGBA")
    cw, ch = cropped.size
    if cw > target_width:
        new_h = max(1, int(round(ch * (target_width / cw))))
        cropped = cropped.resize((target_width, new_h), Image.Resampling.LANCZOS)

    cropped.save(out_path, format="PNG", optimize=True)
    print(json.dumps({"width": cropped.width, "height": cropped.height}))


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--interior-key"]
    use_interior = "--interior-key" in sys.argv[1:]
    in_file = args[0]
    out_file = args[1]
    t_width = int(args[2]) if len(args) > 2 else 280
    cutout_and_trim(in_file, out_file, t_width, interior_key=use_interior)
