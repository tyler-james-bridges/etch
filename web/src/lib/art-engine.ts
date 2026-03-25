// ETCH Generative Art Engine
// Ported from art-preview/v2.html - deterministic, hash-seeded generative art

const SIZE = 400;

type Palette = {
  bg: [number, number, number];
  primary: [number, number, number];
  secondary: [number, number, number];
  dim: [number, number, number];
};

export const PALETTES: Record<number, Palette> = {
  0: {
    bg: [6, 10, 20],
    primary: [96, 165, 250],
    secondary: [147, 197, 253],
    dim: [30, 58, 138],
  },
  1: {
    bg: [6, 16, 10],
    primary: [34, 197, 94],
    secondary: [134, 239, 172],
    dim: [20, 83, 45],
  },
  2: {
    bg: [12, 8, 24],
    primary: [167, 139, 250],
    secondary: [196, 181, 253],
    dim: [76, 29, 149],
  },
  3: {
    bg: [16, 12, 4],
    primary: [251, 146, 60],
    secondary: [253, 186, 116],
    dim: [124, 45, 18],
  },
  4: {
    bg: [6, 16, 20],
    primary: [34, 211, 238],
    secondary: [103, 232, 249],
    dim: [14, 116, 144],
  },
};

// Default palette for unknown types (same as Identity)
const DEFAULT_PALETTE: Palette = PALETTES[0];

export class SimplexNoise {
  private grad3: number[][];
  private perm: Uint8Array;

  constructor(seed: number) {
    this.grad3 = [
      [1, 1, 0],
      [-1, 1, 0],
      [1, -1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, -1, 1],
      [0, 1, -1],
      [0, -1, -1],
    ];
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t,
      Y0 = j - t;
    const x0 = x - X0,
      y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2,
      y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2,
      y2 = y0 - 1 + 2 * G2;
    const ii = i & 255,
      jj = j & 255;
    const dot = (g: number[], gx: number, gy: number) => g[0] * gx + g[1] * gy;
    let n0 = 0,
      n1 = 0,
      n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 =
        t0 *
        t0 *
        dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 =
        t1 *
        t1 *
        dot(
          this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12],
          x1,
          y1
        );
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 =
        t2 *
        t2 *
        dot(
          this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12],
          x2,
          y2
        );
    }
    return 70 * (n0 + n1 + n2);
  }
}

export class Rand {
  private s: number;

  constructor(seed: number) {
    this.s = seed;
  }

  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return this.s / 2147483647;
  }

  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b));
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length)];
  }
}

export function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function rgb(c: [number, number, number]): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function rgba(c: [number, number, number], a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

// -- IDENTITY: Sacred geometry, crystalline lattice --
function drawIdentity(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  noise: SimplexNoise,
  pal: Palette,
  size: number
) {
  const s = size / SIZE;
  ctx.fillStyle = rgb(pal.bg);
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2,
    cy = size / 2;
  const layers = rng.int(6, 12);
  const baseRotation = rng.range(0, Math.PI);
  const symmetry = rng.pick([3, 4, 5, 6, 8]);

  for (let x = 0; x < size; x += 4 * s) {
    for (let y = 0; y < size; y += 4 * s) {
      const n = noise.noise2D((x / s) * 0.01, (y / s) * 0.01);
      if (n > 0.3) {
        ctx.fillStyle = rgba(pal.primary, (n - 0.3) * 0.08);
        ctx.fillRect(x, y, 2 * s, 2 * s);
      }
    }
  }

  for (let l = 0; l < layers; l++) {
    const radius = (30 + l * ((SIZE * 0.4) / layers)) * s;
    const rot = baseRotation + l * rng.range(0.05, 0.3);
    const alpha = 0.1 + (l / layers) * 0.5;
    const lw = (0.5 + (l / layers) * 1.5) * s;

    ctx.strokeStyle = rgba(pal.primary, alpha);
    ctx.lineWidth = lw;

    ctx.beginPath();
    for (let i = 0; i <= symmetry; i++) {
      const a = rot + (i / symmetry) * Math.PI * 2;
      const noiseScale = Math.max(0, 1 - l / layers) * 0.08;
      const nr = radius + noise.noise2D(a * 2, l * 0.5) * (radius * noiseScale) * s;
      const px = cx + Math.cos(a) * nr;
      const py = cy + Math.sin(a) * nr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    if (l > 1 && rng.next() > 0.3) {
      const prevRadius = (30 + (l - 1) * ((SIZE * 0.4) / layers)) * s;
      ctx.strokeStyle = rgba(pal.dim, alpha * 0.5);
      ctx.lineWidth = 0.3 * s;
      for (let i = 0; i < symmetry; i++) {
        const a = rot + (i / symmetry) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * prevRadius, cy + Math.sin(a) * prevRadius);
        ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        ctx.stroke();
      }
    }
  }

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 * s);
  g.addColorStop(0, rgba(pal.primary, 0.6));
  g.addColorStop(0.5, rgba(pal.primary, 0.1));
  g.addColorStop(1, rgba(pal.primary, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 50 * s, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 100; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(10, SIZE * 0.45) * s;
    const px = cx + Math.cos(a) * d;
    const py = cy + Math.sin(a) * d;
    const sz = rng.range(0.5, 2.5) * s;
    const al = rng.range(0.05, 0.4) * (1 - d / (size * 0.5));
    ctx.fillStyle = rgba(pal.secondary, al);
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -- ATTESTATION: Flow field with particle traces --
function drawAttestation(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  noise: SimplexNoise,
  pal: Palette,
  size: number
) {
  const s = size / SIZE;
  ctx.fillStyle = rgb(pal.bg);
  ctx.fillRect(0, 0, size, size);

  const scale = rng.range(0.002, 0.006);
  const strength = rng.range(2, 5);
  const particles = rng.int(200, 400);
  const steps = rng.int(80, 150);
  const offset = rng.range(0, 100);

  for (let p = 0; p < particles; p++) {
    let x = rng.range(0, size);
    let y = rng.range(0, size);
    const hueShift = rng.next();
    const lineAlpha = rng.range(0.02, 0.12);
    const lw = rng.range(0.3, 1.5) * s;

    const color =
      hueShift > 0.7
        ? pal.secondary
        : hueShift > 0.3
          ? pal.primary
          : pal.dim;
    ctx.strokeStyle = rgba(color, lineAlpha);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let st = 0; st < steps; st++) {
      const n1 = noise.noise2D((x / s) * scale + offset, (y / s) * scale + offset);
      const angle = n1 * Math.PI * strength;
      x += Math.cos(angle) * 2 * s;
      y += Math.sin(angle) * 2 * s;
      ctx.lineTo(x, y);
      if (x < -20 * s || x > size + 20 * s || y < -20 * s || y > size + 20 * s)
        break;
    }
    ctx.stroke();
  }

  for (let i = 0; i < rng.int(3, 8); i++) {
    const nx = rng.range(50, SIZE - 50) * s;
    const ny = rng.range(50, SIZE - 50) * s;
    const nr = rng.range(15, 40) * s;
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    g.addColorStop(0, rgba(pal.primary, 0.3));
    g.addColorStop(1, rgba(pal.primary, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(nx, ny, nr, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -- CREDENTIAL: Dense layered data matrix --
function drawCredential(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  noise: SimplexNoise,
  pal: Palette,
  size: number
) {
  const s = size / SIZE;
  ctx.fillStyle = rgb(pal.bg);
  ctx.fillRect(0, 0, size, size);

  const cellSize = rng.int(8, 14);
  const cols = Math.ceil(SIZE / cellSize);
  const rows = Math.ceil(SIZE / cellSize);
  const noiseScale = rng.range(0.015, 0.04);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize * s;
      const y = r * cellSize * s;
      const n = noise.noise2D(c * noiseScale, r * noiseScale);
      const density = (n + 1) / 2;

      if (density > 0.7) {
        ctx.fillStyle = rgba(pal.primary, (density - 0.7) * 1.5);
        ctx.fillRect(x + s, y + s, (cellSize - 2) * s, (cellSize - 2) * s);
      } else if (density > 0.5) {
        ctx.strokeStyle = rgba(pal.primary, (density - 0.5) * 0.8);
        ctx.lineWidth = 0.5 * s;
        ctx.strokeRect(x + s, y + s, (cellSize - 2) * s, (cellSize - 2) * s);
      } else if (density > 0.35) {
        ctx.fillStyle = rgba(pal.dim, (density - 0.35) * 0.6);
        ctx.beginPath();
        ctx.arc(
          x + (cellSize / 2) * s,
          y + (cellSize / 2) * s,
          1 * s,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }

  const bands = rng.int(3, 7);
  for (let b = 0; b < bands; b++) {
    const angle = rng.range(0, Math.PI);
    const offset = rng.range(-100, SIZE + 100) * s;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angle);
    ctx.fillStyle = rgba(pal.secondary, 0.03);
    ctx.fillRect(-size, offset - size / 2, size * 2, rng.range(20, 80) * s);
    ctx.restore();
  }

  for (let i = 0; i < rng.int(5, 15); i++) {
    const x = rng.range(20, SIZE - 20) * s;
    const y = rng.range(20, SIZE - 20) * s;
    const r = rng.range(2, 6) * s;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, rgba(pal.secondary, 0.5));
    g.addColorStop(1, rgba(pal.secondary, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// -- RECEIPT: Clean data visualization --
function drawReceipt(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  noise: SimplexNoise,
  pal: Palette,
  size: number
) {
  const s = size / SIZE;
  ctx.fillStyle = rgb(pal.bg);
  ctx.fillRect(0, 0, size, size);

  const bandCount = rng.int(40, 80);
  for (let i = 0; i < bandCount; i++) {
    const y = (i / bandCount) * size;
    const n = noise.noise2D(i * 0.1, 0);
    const width = Math.abs(n) * size * 0.8;
    const x = (size - width) / 2 + noise.noise2D(0, i * 0.1) * 40 * s;
    const alpha = rng.range(0.03, 0.15);
    ctx.fillStyle = rgba(n > 0 ? pal.primary : pal.dim, alpha);
    ctx.fillRect(x, y, width, rng.range(1, 3) * s);
  }

  const ticks = rng.int(20, 50);
  for (let i = 0; i < ticks; i++) {
    const x = rng.range(20, SIZE - 20) * s;
    const y1 = rng.range(10, SIZE - 10) * s;
    const y2 = y1 + rng.range(5, 40) * s;
    ctx.strokeStyle = rgba(pal.primary, rng.range(0.1, 0.35));
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  const sections = rng.int(2, 5);
  for (let i = 0; i < sections; i++) {
    const x = rng.range(30, SIZE * 0.3) * s;
    const y = rng.range(30, SIZE - 100) * s;
    const w = rng.range(SIZE * 0.3, SIZE * 0.6) * s;
    const h = rng.range(30, 80) * s;
    ctx.strokeStyle = rgba(pal.primary, rng.range(0.08, 0.25));
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(x, y, w, h);

    const dots = rng.int(3, 10);
    for (let d = 0; d < dots; d++) {
      ctx.fillStyle = rgba(pal.secondary, rng.range(0.2, 0.5));
      ctx.fillRect(
        x + rng.range(5, w / s - 5) * s,
        y + rng.range(5, h / s - 5) * s,
        2 * s,
        2 * s
      );
    }
  }
}

// -- PASS: Energetic network, access topology --
function drawPass(
  ctx: CanvasRenderingContext2D,
  rng: Rand,
  noise: SimplexNoise,
  pal: Palette,
  size: number
) {
  const s = size / SIZE;
  ctx.fillStyle = rgb(pal.bg);
  ctx.fillRect(0, 0, size, size);

  const nodeCount = rng.int(8, 20);
  const nodes: { x: number; y: number; r: number; energy: number }[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: rng.range(40, SIZE - 40) * s,
      y: rng.range(40, SIZE - 40) * s,
      r: rng.range(3, 12) * s,
      energy: rng.range(0.3, 1),
    });
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < rng.range(100, 200) * s) {
        const alpha = (1 - dist / (200 * s)) * 0.3 * nodes[i].energy;
        ctx.strokeStyle = rgba(pal.primary, alpha);
        ctx.lineWidth = rng.range(0.3, 1.5) * s;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        const midX =
          (nodes[i].x + nodes[j].x) / 2 + noise.noise2D(i, j) * 30 * s;
        const midY =
          (nodes[i].y + nodes[j].y) / 2 + noise.noise2D(j, i) * 30 * s;
        ctx.quadraticCurveTo(midX, midY, nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }

  for (const node of nodes) {
    const rays = rng.int(8, 25);
    for (let r = 0; r < rays; r++) {
      const angle = rng.range(0, Math.PI * 2);
      const len = rng.range(15, 60) * node.energy * s;
      ctx.strokeStyle = rgba(pal.primary, rng.range(0.03, 0.15));
      ctx.lineWidth = 0.5 * s;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(
        node.x + Math.cos(angle) * len,
        node.y + Math.sin(angle) * len
      );
      ctx.stroke();
    }

    const g = ctx.createRadialGradient(
      node.x,
      node.y,
      0,
      node.x,
      node.y,
      node.r * 3
    );
    g.addColorStop(0, rgba(pal.primary, 0.5 * node.energy));
    g.addColorStop(0.5, rgba(pal.primary, 0.1 * node.energy));
    g.addColorStop(1, rgba(pal.primary, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgba(pal.secondary, 0.6 * node.energy);
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 150; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const n = noise.noise2D((x / s) * 0.008, (y / s) * 0.008);
    if (n > 0.2) {
      ctx.fillStyle = rgba(pal.dim, (n - 0.2) * 0.15);
      ctx.fillRect(x, y, 1 * s, 1 * s);
    }
  }
}

const DRAW_FUNCTIONS = [
  drawIdentity,
  drawAttestation,
  drawCredential,
  drawReceipt,
  drawPass,
];

export function renderEtchArt(
  ctx: CanvasRenderingContext2D,
  tokenId: number,
  tokenType: number,
  size: number = SIZE
): void {
  const seed = hashSeed("etch-" + tokenId);
  const rng = new Rand(seed);
  const noise = new SimplexNoise(seed);
  const pal = PALETTES[tokenType] ?? DEFAULT_PALETTE;
  const drawFn = DRAW_FUNCTIONS[tokenType] ?? DRAW_FUNCTIONS[0];
  drawFn(ctx, rng, noise, pal, size);
}
