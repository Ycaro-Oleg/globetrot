// HTML/SVG overlay projected from MapLibre: crisp, styleable, accessible pins + airmail routes + label collision.
import type { Map as MlMap } from 'maplibre-gl';
import type { PinData } from './data';

interface Placed {
  data: PinData;
  el: HTMLButtonElement;
  label: HTMLSpanElement;
  size: { full: [number, number]; short: [number, number] };
  x: number;
  y: number;
  visible: boolean;
}

type Box = { l: number; t: number; r: number; b: number };
const PLACEMENTS = ['right', 'left', 'below', 'left-below', 'above', 'left-above'] as const;
const GAP = 18;

export interface OverlayStats {
  lastFrameMs: number;
  lastLabelMs: number;
  labelsShown: number;
}

export class PinOverlay {
  private placed: Placed[] = [];
  private svg: SVGSVGElement;
  private routePaths: SVGPathElement[][] = [];
  readonly stats: OverlayStats = { lastFrameMs: 0, lastLabelMs: 0, labelsShown: 0 };
  selectedId: string | null = 'kyoto';
  insetRight = 0;

  constructor(
    private map: MlMap,
    private host: HTMLElement,
    pins: PinData[],
    private onPin: (pin: PinData) => void,
  ) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('routes');
    host.appendChild(this.svg);
    this.setPins(pins);
    map.on('move', () => this.update());
    map.on('moveend', () => this.resolveLabels());
    map.on('resize', () => {
      this.update();
      this.resolveLabels();
    });
  }

  setPins(pins: PinData[]): void {
    for (const p of this.placed) p.el.remove();
    this.placed = pins.map((data) => {
      const el = document.createElement('button');
      el.className = `pin ${data.kind}`;
      el.type = 'button';
      el.setAttribute('aria-label', data.order ? `${data.name}, stop ${data.order}` : data.name);
      el.innerHTML = `<i class="head">${data.order ?? ''}</i>`;
      const label = document.createElement('span');
      label.className = 'lb';
      label.innerHTML = `${data.name}${data.sub ? `<small>${data.sub}</small>` : ''}`;
      el.appendChild(label);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPin(data);
      });
      this.host.appendChild(el);
      return { data, el, label, size: { full: [0, 0], short: [0, 0] }, x: 0, y: 0, visible: true };
    });
    // Measure label sizes once (with and without the sub-line) so placement is pure arithmetic later.
    for (const p of this.placed) {
      p.label.style.visibility = 'hidden';
      p.label.dataset.place = 'right';
      p.size.full = [p.label.offsetWidth, p.label.offsetHeight];
      p.label.classList.add('nosub');
      p.size.short = [p.label.offsetWidth, p.label.offsetHeight];
      p.label.classList.remove('nosub');
      p.label.style.visibility = '';
    }
    this.buildRoutes();
    this.update();
    this.resolveLabels();
  }

  private buildRoutes(): void {
    this.svg.innerHTML = '';
    const stops = this.placed.filter((p) => p.data.kind === 'stop');
    this.routePaths = stops.slice(1).map(() => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('air');
      const paths = ['air0', 'air1', 'air2'].map((cls) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add(cls);
        g.appendChild(path);
        return path;
      });
      this.svg.appendChild(g);
      return paths;
    });
  }

  /** Runs on every map frame: only transforms and path strings, no layout reads. */
  update(): void {
    const t0 = performance.now();
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (const p of this.placed) {
      const pt = this.map.project(p.data.ll);
      p.x = pt.x;
      p.y = pt.y;
      p.visible = pt.x > -60 && pt.y > -60 && pt.x < w + 60 && pt.y < h + 60;
      p.el.style.display = p.visible ? '' : 'none';
      if (p.visible) p.el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0)`;
      p.el.classList.toggle('sel', p.data.id === this.selectedId);
    }
    const stops = this.placed.filter((p) => p.data.kind === 'stop');
    this.routePaths.forEach((paths, i) => {
      const a = stops[i]!;
      const b = stops[i + 1]!;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const d = `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)},${((a.y + b.y) / 2 - dist * 0.2).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      for (const path of paths) path.setAttribute('d', d);
    });
    this.stats.lastFrameMs = performance.now() - t0;
  }

  /** Greedy label placement in priority order (selected, stops, then places), pure arithmetic. */
  resolveLabels(): void {
    const t0 = performance.now();
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const right = w - 4 - this.insetRight;
    const zoom = this.map.getZoom();
    const boxes: Box[] = [];
    const heads: Box[] = this.placed.filter((p) => p.visible).map((p) => ({ l: p.x - 16, t: p.y - 16, r: p.x + 16, b: p.y + 16 }));
    const hit = (a: Box, b: Box) => !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b);
    const selected = this.selectedId;
    const rank = (p: Placed) => (p.data.id === selected ? 100 : 0) + (p.data.kind === 'stop' ? 10 : 0);
    const order = [...this.placed].sort((a, b) => rank(b) - rank(a));
    let shown = 0;
    for (const p of order) {
      if (!p.visible || (p.data.kind !== 'stop' && zoom < 5.2)) {
        p.label.dataset.place = 'none';
        continue;
      }
      let placedHere = false;
      for (const variant of ['full', 'short'] as const) {
        if (variant === 'full' && !p.data.sub) continue;
        const [lw, lh] = p.size[variant];
        for (const place of PLACEMENTS) {
          const box = boxAt(place, p.x, p.y, lw, lh);
          const own = { l: p.x - 16, t: p.y - 16, r: p.x + 16, b: p.y + 16 };
          const bad =
            box.l < 4 || box.t < 4 || box.r > right || box.b > h - 4 ||
            boxes.some((b) => hit(box, b)) ||
            heads.some((hd) => !(hd.l === own.l && hd.t === own.t) && hit(box, hd));
          if (!bad) {
            boxes.push(box);
            p.label.dataset.place = place;
            p.label.classList.toggle('nosub', variant === 'short');
            placedHere = true;
            shown++;
            break;
          }
        }
        if (placedHere) break;
      }
      if (!placedHere) p.label.dataset.place = 'none';
    }
    this.stats.labelsShown = shown;
    this.stats.lastLabelMs = performance.now() - t0;
  }
}

function boxAt(place: (typeof PLACEMENTS)[number], x: number, y: number, w: number, h: number): Box {
  switch (place) {
    case 'right':
      return { l: x + GAP, t: y - h / 2, r: x + GAP + w, b: y + h / 2 };
    case 'left':
      return { l: x - GAP - w, t: y - h / 2, r: x - GAP, b: y + h / 2 };
    case 'below':
      return { l: x - w / 2, t: y + GAP, r: x + w / 2, b: y + GAP + h };
    case 'left-below':
      return { l: x - GAP - w, t: y + 8, r: x - GAP, b: y + 8 + h };
    case 'above':
      return { l: x - w / 2, t: y - GAP - h, r: x + w / 2, b: y - GAP };
    case 'left-above':
      return { l: x - GAP - w, t: y - 8 - h, r: x - GAP, b: y - 8 };
  }
}

/** 500 plain DOM dots, repositioned every frame: the "DOM overlay at scale" side of the comparison. */
export class DomPoiLayer {
  private els: { el: HTMLElement; ll: [number, number] }[] = [];
  private handler = () => this.update();
  constructor(
    private map: MlMap,
    private host: HTMLElement,
  ) {}

  show(points: GeoJSON.FeatureCollection<GeoJSON.Point>): void {
    this.hide();
    for (const f of points.features) {
      const el = document.createElement('button');
      el.className = 'poi-dom';
      el.type = 'button';
      el.setAttribute('aria-label', String(f.properties?.['name'] ?? 'Place'));
      this.host.appendChild(el);
      this.els.push({ el, ll: f.geometry.coordinates as [number, number] });
    }
    this.map.on('move', this.handler);
    this.update();
  }

  hide(): void {
    this.map.off('move', this.handler);
    for (const e of this.els) e.el.remove();
    this.els = [];
  }

  private update(): void {
    for (const { el, ll } of this.els) {
      const pt = this.map.project(ll);
      el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0)`;
    }
  }
}
