export interface ComfySpriteEntry {
  id: string;
  category: string;
  file: string;
  footprint: '1x1' | '2x1' | '3x1' | '7-hex';
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  hexTile?: boolean;
  image?: HTMLImageElement;
  loaded?: boolean;
}

class ComfyPropAtlasManager {
  private byCategory = new Map<string, ComfySpriteEntry[]>();
  private byId = new Map<string, ComfySpriteEntry>();
  private loadingStarted = false;
  private listeners = new Set<() => void>();

  ensureLoaded() {
    if (this.loadingStarted) return;
    this.loadingStarted = true;

    fetch('/assets/sprites/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { sprites?: ComfySpriteEntry[] } | null) => {
        if (!data?.sprites) return;
        for (const entry of data.sprites) {
          if (!this.byCategory.has(entry.category)) {
            this.byCategory.set(entry.category, []);
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          entry.image = img;
          entry.loaded = false;
          img.onload = () => {
            entry.loaded = true;
            this.notify();
          };
          img.src = entry.file;
          this.byCategory.get(entry.category)!.push(entry);
          this.byId.set(entry.id, entry);
        }
        this.notify();
      })
      .catch(() => {
        // Fallback to procedural sprites if manifest is unavailable
      });
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  getSprite(
    category: string,
    seed: number,
    preferredFootprint?: '1x1' | '2x1' | '3x1' | '7-hex'
  ): ComfySpriteEntry | null {
    this.ensureLoaded();
    const list = this.byCategory.get(category);
    if (!list || list.length === 0) return null;

    const filtered = preferredFootprint
      ? list.filter((s) => s.footprint === preferredFootprint && s.loaded)
      : list.filter((s) => s.loaded);

    const pool = filtered.length > 0 ? filtered : list.filter((s) => s.loaded);
    if (pool.length === 0) return null;
    return pool[Math.abs(seed) % pool.length];
  }

  getSpriteFromIds(ids: string[], seed: number): ComfySpriteEntry | null {
    this.ensureLoaded();
    const pool: ComfySpriteEntry[] = [];
    for (const id of ids) {
      const sp = this.byId.get(id);
      if (sp && sp.loaded) pool.push(sp);
    }
    if (pool.length === 0) return null;
    return pool[Math.abs(seed) % pool.length];
  }
}

export const comfyPropAtlas = new ComfyPropAtlasManager();
