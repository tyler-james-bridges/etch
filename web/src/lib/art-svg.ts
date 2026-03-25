// ETCH SVG Art Engine - Fully onchain vector art
// Deterministic: same tokenId always produces same SVG

const SIZE = 400;
const VIEWBOX_PADDING = 8;

type Palette = {
  bg: [number, number, number];
  primary: [number, number, number];
  secondary: [number, number, number];
  dim: [number, number, number];
};

const PALETTES: Record<number, Palette> = {
  0: { bg: [6, 10, 20], primary: [96, 165, 250], secondary: [147, 197, 253], dim: [30, 58, 138] },
  1: { bg: [6, 16, 10], primary: [34, 197, 94], secondary: [134, 239, 172], dim: [20, 83, 45] },
  2: { bg: [12, 8, 24], primary: [167, 139, 250], secondary: [196, 181, 253], dim: [76, 29, 149] },
  3: { bg: [16, 12, 4], primary: [251, 146, 60], secondary: [253, 186, 116], dim: [124, 45, 18] },
  4: { bg: [6, 16, 20], primary: [34, 211, 238], secondary: [103, 232, 249], dim: [14, 116, 144] },
};

class SimplexNoise {
  private grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  private perm: Uint8Array;

  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const dot = (g: number[], a: number, b: number) => g[0] * a + g[1] * b;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * dot(this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12], x1, y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * dot(this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12], x2, y2); }
    return 70 * (n0 + n1 + n2);
  }
}

class Rand {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b)); }
  pick<T>(arr: T[]): T { return arr[this.int(0, arr.length)]; }
}

function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function rgb(c: number[]): string { return `rgb(${c[0]},${c[1]},${c[2]})`; }

class SvgBuilder {
  private defs: string[] = [];
  private elements: string[] = [];
  private defCount = 0;
  constructor(private size: number) {}

  rect(x: number, y: number, w: number, h: number, fill: string, opacity?: number) {
    this.elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity !== undefined ? ` opacity="${opacity.toFixed(3)}"` : ''}/>`);
  }
  strokeRect(x: number, y: number, w: number, h: number, stroke: string, sw: number, opacity?: number) {
    this.elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="${sw}"${opacity !== undefined ? ` opacity="${opacity.toFixed(3)}"` : ''}/>`);
  }
  circle(cx: number, cy: number, r: number, fill: string, opacity?: number) {
    this.elements.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${opacity !== undefined ? ` opacity="${opacity.toFixed(3)}"` : ''}/>`);
  }
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, sw: number, opacity?: number) {
    this.elements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${opacity !== undefined ? ` opacity="${opacity.toFixed(3)}"` : ''}/>`);
  }
  path(d: string, stroke?: string, sw?: number, opacity?: number, fill?: string) {
    this.elements.push(`<path d="${d}" fill="${fill || 'none'}" stroke="${stroke || 'none'}" stroke-width="${sw || 0}"${opacity !== undefined ? ` opacity="${opacity.toFixed(3)}"` : ''}/>`);
  }
  polygon(points: number[][], stroke: string, sw: number, opacity?: number) {
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';
    this.path(d, stroke, sw, opacity);
  }
  quadCurve(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, stroke: string, sw: number, opacity?: number) {
    this.path(`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, stroke, sw, opacity);
  }
  radialGradient(cx: number, cy: number, r: number, stops: [number, string, number][]): string {
    const id = `rg${this.defCount++}`;
    const s = stops.map(st => `<stop offset="${st[0]}" stop-color="${st[1]}" stop-opacity="${st[2]}"/>`).join('');
    this.defs.push(`<radialGradient id="${id}" cx="${cx / this.size}" cy="${cy / this.size}" r="${r / this.size}" gradientUnits="objectBoundingBox">${s}</radialGradient>`);
    return `url(#${id})`;
  }
  toString(): string {
    const paddedSize = this.size + VIEWBOX_PADDING * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-VIEWBOX_PADDING} ${-VIEWBOX_PADDING} ${paddedSize} ${paddedSize}" width="${this.size}" height="${this.size}">${this.defs.length ? '<defs>' + this.defs.join('') + '</defs>' : ''}${this.elements.join('')}</svg>`;
  }
}

function drawIdentity(rng: Rand, noise: SimplexNoise, pal: Palette): string {
  const svg = new SvgBuilder(SIZE);
  svg.rect(0, 0, SIZE, SIZE, rgb(pal.bg));
  const cx = SIZE / 2, cy = SIZE / 2;
  const layers = rng.int(6, 12);
  const baseRotation = rng.range(0, Math.PI);
  const symmetry = rng.pick([3, 4, 5, 6, 8]);

  for (let x = 0; x < SIZE; x += 4) {
    for (let y = 0; y < SIZE; y += 4) {
      const n = noise.noise2D(x * 0.01, y * 0.01);
      if (n > 0.3) svg.rect(x, y, 2, 2, rgb(pal.primary), (n - 0.3) * 0.08);
    }
  }

  for (let l = 0; l < layers; l++) {
    const radius = 30 + l * ((SIZE * 0.4) / layers);
    const rot = baseRotation + l * rng.range(0.05, 0.3);
    const alpha = 0.1 + (l / layers) * 0.5;
    const lw = 0.5 + (l / layers) * 1.5;
    const points: number[][] = [];
    for (let i = 0; i < symmetry; i++) {
      const a = rot + (i / symmetry) * Math.PI * 2;
      const noiseScale = Math.max(0, 1 - l / layers) * 0.08;
      const nr = radius + noise.noise2D(a * 2, l * 0.5) * (radius * noiseScale);
      points.push([cx + Math.cos(a) * nr, cy + Math.sin(a) * nr]);
    }
    svg.polygon(points, rgb(pal.primary), lw, alpha);
    if (l > 1 && rng.next() > 0.3) {
      const pr = 30 + (l - 1) * ((SIZE * 0.4) / layers);
      for (let i = 0; i < symmetry; i++) {
        const a = rot + (i / symmetry) * Math.PI * 2;
        svg.line(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, rgb(pal.dim), 0.3, alpha * 0.5);
      }
    }
  }

  const glow = svg.radialGradient(cx, cy, 50, [[0, rgb(pal.primary), 0.6], [0.5, rgb(pal.primary), 0.1], [1, rgb(pal.primary), 0]]);
  svg.circle(cx, cy, 50, glow);

  for (let i = 0; i < 100; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(10, SIZE * 0.45);
    svg.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rng.range(0.5, 2.5), rgb(pal.secondary), rng.range(0.05, 0.4) * (1 - d / (SIZE * 0.5)));
  }
  return svg.toString();
}

function drawAttestation(rng: Rand, noise: SimplexNoise, pal: Palette): string {
  const svg = new SvgBuilder(SIZE);
  svg.rect(0, 0, SIZE, SIZE, rgb(pal.bg));
  const scale = rng.range(0.002, 0.006);
  const strength = rng.range(2, 5);
  const particles = rng.int(120, 250);
  const steps = rng.int(60, 100);
  const offset = rng.range(0, 100);

  for (let p = 0; p < particles; p++) {
    let x = rng.range(0, SIZE), y = rng.range(0, SIZE);
    const hs = rng.next();
    const la = rng.range(0.02, 0.12);
    const lw = rng.range(0.3, 1.5);
    const color = hs > 0.7 ? pal.secondary : hs > 0.3 ? pal.primary : pal.dim;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let s = 0; s < steps; s++) {
      const angle = noise.noise2D(x * scale + offset, y * scale + offset) * Math.PI * strength;
      x += Math.cos(angle) * 2; y += Math.sin(angle) * 2;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) break;
    }
    svg.path(d, rgb(color), lw, la);
  }

  for (let i = 0; i < rng.int(3, 8); i++) {
    const nx = rng.range(50, SIZE - 50), ny = rng.range(50, SIZE - 50), nr = rng.range(15, 40);
    svg.circle(nx, ny, nr, svg.radialGradient(nx, ny, nr, [[0, rgb(pal.primary), 0.3], [1, rgb(pal.primary), 0]]));
  }
  return svg.toString();
}

function drawCredential(rng: Rand, noise: SimplexNoise, pal: Palette): string {
  const svg = new SvgBuilder(SIZE);
  svg.rect(0, 0, SIZE, SIZE, rgb(pal.bg));
  const cellSize = rng.int(8, 14);
  const cols = Math.ceil(SIZE / cellSize), rows = Math.ceil(SIZE / cellSize);
  const ns = rng.range(0.015, 0.04);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize, y = r * cellSize;
      const density = (noise.noise2D(c * ns, r * ns) + 1) / 2;
      if (density > 0.7) svg.rect(x + 1, y + 1, cellSize - 2, cellSize - 2, rgb(pal.primary), (density - 0.7) * 1.5);
      else if (density > 0.5) svg.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2, rgb(pal.primary), 0.5, (density - 0.5) * 0.8);
      else if (density > 0.35) svg.circle(x + cellSize / 2, y + cellSize / 2, 1, rgb(pal.dim), (density - 0.35) * 0.6);
    }
  }

  for (let b = 0; b < rng.int(3, 7); b++) svg.rect(0, rng.range(0, SIZE), SIZE, rng.range(20, 80), rgb(pal.secondary), 0.03);

  for (let i = 0; i < rng.int(5, 15); i++) {
    const x = rng.range(20, SIZE - 20), y = rng.range(20, SIZE - 20), r = rng.range(2, 6);
    svg.circle(x, y, r * 4, svg.radialGradient(x, y, r * 4, [[0, rgb(pal.secondary), 0.5], [1, rgb(pal.secondary), 0]]));
  }
  return svg.toString();
}

function drawReceipt(rng: Rand, noise: SimplexNoise, pal: Palette): string {
  const svg = new SvgBuilder(SIZE);
  svg.rect(0, 0, SIZE, SIZE, rgb(pal.bg));
  const bandCount = rng.int(40, 80);
  for (let i = 0; i < bandCount; i++) {
    const y = (i / bandCount) * SIZE;
    const n = noise.noise2D(i * 0.1, 0);
    const width = Math.abs(n) * SIZE * 0.8;
    svg.rect((SIZE - width) / 2 + noise.noise2D(0, i * 0.1) * 40, y, width, rng.range(1, 3), rgb(n > 0 ? pal.primary : pal.dim), rng.range(0.03, 0.15));
  }
  for (let i = 0; i < rng.int(20, 50); i++) {
    const x = rng.range(20, SIZE - 20), y1 = rng.range(10, SIZE - 10);
    svg.line(x, y1, x, y1 + rng.range(5, 40), rgb(pal.primary), 1, rng.range(0.1, 0.35));
  }
  for (let i = 0; i < rng.int(2, 5); i++) {
    const x = rng.range(30, SIZE * 0.3), y = rng.range(30, SIZE - 100), w = rng.range(SIZE * 0.3, SIZE * 0.6), h = rng.range(30, 80);
    svg.strokeRect(x, y, w, h, rgb(pal.primary), 1, rng.range(0.08, 0.25));
    for (let d = 0; d < rng.int(3, 10); d++) svg.rect(x + rng.range(5, w - 5), y + rng.range(5, h - 5), 2, 2, rgb(pal.secondary), rng.range(0.2, 0.5));
  }
  return svg.toString();
}

function drawPass(rng: Rand, noise: SimplexNoise, pal: Palette): string {
  const svg = new SvgBuilder(SIZE);
  svg.rect(0, 0, SIZE, SIZE, rgb(pal.bg));
  const nodeCount = rng.int(8, 20);
  const nodes: { x: number; y: number; r: number; energy: number }[] = [];
  for (let i = 0; i < nodeCount; i++) nodes.push({ x: rng.range(40, SIZE - 40), y: rng.range(40, SIZE - 40), r: rng.range(3, 12), energy: rng.range(0.3, 1) });

  for (let i = 0; i < 150; i++) {
    const x = rng.range(0, SIZE), y = rng.range(0, SIZE);
    const n = noise.noise2D(x * 0.008, y * 0.008);
    if (n > 0.2) svg.rect(x, y, 1, 1, rgb(pal.dim), (n - 0.2) * 0.15);
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < rng.range(100, 200)) {
        const alpha = (1 - dist / 200) * 0.3 * nodes[i].energy;
        const mx = (nodes[i].x + nodes[j].x) / 2 + noise.noise2D(i, j) * 30;
        const my = (nodes[i].y + nodes[j].y) / 2 + noise.noise2D(j, i) * 30;
        svg.quadCurve(nodes[i].x, nodes[i].y, mx, my, nodes[j].x, nodes[j].y, rgb(pal.primary), rng.range(0.3, 1.5), alpha);
      }
    }
  }

  for (const node of nodes) {
    for (let r = 0; r < rng.int(8, 25); r++) {
      const angle = rng.range(0, Math.PI * 2), len = rng.range(15, 60) * node.energy;
      svg.line(node.x, node.y, node.x + Math.cos(angle) * len, node.y + Math.sin(angle) * len, rgb(pal.primary), 0.5, rng.range(0.03, 0.15));
    }
    svg.circle(node.x, node.y, node.r * 3, svg.radialGradient(node.x, node.y, node.r * 3, [[0, rgb(pal.primary), 0.5 * node.energy], [0.5, rgb(pal.primary), 0.1 * node.energy], [1, rgb(pal.primary), 0]]));
    svg.circle(node.x, node.y, node.r * 0.4, rgb(pal.secondary), 0.6 * node.energy);
  }
  return svg.toString();
}

const DRAW_FUNCTIONS = [drawIdentity, drawAttestation, drawCredential, drawReceipt, drawPass];
const DEFAULT_PALETTE = PALETTES[0];

export function generateEtchSvg(tokenId: number, tokenType: number): string {
  const seed = hashSeed("etch-" + tokenId);
  const rng = new Rand(seed);
  const noise = new SimplexNoise(seed);
  const pal = PALETTES[tokenType] ?? DEFAULT_PALETTE;
  const drawFn = DRAW_FUNCTIONS[tokenType] ?? DRAW_FUNCTIONS[0];
  return drawFn(rng, noise, pal);
}

export function generateEtchMetadata(tokenId: number, tokenType: number, name: string, description: string, soulbound: boolean): string {
  const svg = generateEtchSvg(tokenId, tokenType);
  const svgBase64 = typeof btoa === 'function'
    ? btoa(svg)
    : Buffer.from(svg).toString('base64');

  const typeLabels = ["Identity", "Attestation", "Credential", "Receipt", "Pass"];
  const metadata = {
    name: name || `ETCH #${tokenId}`,
    description: description || `An onchain ${typeLabels[tokenType] || "token"} etched permanently on Abstract.`,
    image: `data:image/svg+xml;base64,${svgBase64}`,
    attributes: [
      { trait_type: "Type", value: typeLabels[tokenType] || "Unknown" },
      { trait_type: "Soulbound", value: soulbound ? "Yes" : "No" },
    ],
  };

  return JSON.stringify(metadata);
}
