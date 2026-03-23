#!/usr/bin/env node

const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// Port of the art engine from the TypeScript version
const SIZE = 400;

const PALETTES = {
  0: { bg: [6, 10, 20], primary: [96, 165, 250], secondary: [147, 197, 253], dim: [30, 58, 138] },
  1: { bg: [6, 16, 10], primary: [34, 197, 94], secondary: [134, 239, 172], dim: [20, 83, 45] },
  2: { bg: [12, 8, 24], primary: [167, 139, 250], secondary: [196, 181, 253], dim: [76, 29, 149] },
  3: { bg: [16, 12, 4], primary: [251, 146, 60], secondary: [253, 186, 116], dim: [124, 45, 18] },
  4: { bg: [6, 16, 20], primary: [34, 211, 238], secondary: [103, 232, 249], dim: [14, 116, 144] },
};

class SimplexNoise {
  constructor(seed) {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
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
  
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const dot = (g, x, y) => g[0] * x + g[1] * y;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * dot(this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12], x1, y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * dot(this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12], x2, y2); }
    return 70 * (n0 + n1 + n2);
  }
}

class Rand {
  constructor(seed) { this.s = seed; }
  next() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b)); }
  pick(arr) { return arr[this.int(0, arr.length)]; }
}

function hashSeed(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// Simplified versions of the draw functions for Node.js canvas
function drawIdentity(ctx, rng, noise, pal) {
  ctx.fillStyle = `rgb(${pal.bg.join(',')})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  const cx = SIZE / 2, cy = SIZE / 2;
  const layers = rng.int(6, 12);
  const symmetry = rng.pick([3, 4, 5, 6, 8]);
  
  for (let l = 0; l < layers; l++) {
    const radius = 30 + l * ((SIZE * 0.4) / layers);
    const alpha = 0.1 + (l / layers) * 0.5;
    ctx.strokeStyle = `rgba(${pal.primary.join(',')}, ${alpha})`;
    ctx.lineWidth = 0.5 + (l / layers) * 1.5;
    ctx.beginPath();
    for (let i = 0; i <= symmetry; i++) {
      const a = (i / symmetry) * Math.PI * 2;
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function drawAttestation(ctx, rng, noise, pal) {
  ctx.fillStyle = `rgb(${pal.bg.join(',')})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  const scale = rng.range(0.002, 0.006);
  const particles = rng.int(150, 300);
  
  for (let p = 0; p < particles; p++) {
    let x = rng.range(0, SIZE);
    let y = rng.range(0, SIZE);
    const lineAlpha = rng.range(0.02, 0.12);
    ctx.strokeStyle = `rgba(${pal.primary.join(',')}, ${lineAlpha})`;
    ctx.lineWidth = rng.range(0.3, 1.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    for (let s = 0; s < 60; s++) {
      const n1 = noise.noise2D(x * scale, y * scale);
      const angle = n1 * Math.PI * 3;
      x += Math.cos(angle) * 2;
      y += Math.sin(angle) * 2;
      ctx.lineTo(x, y);
      if (x < 0 || x > SIZE || y < 0 || y > SIZE) break;
    }
    ctx.stroke();
  }
}

function drawCredential(ctx, rng, noise, pal) {
  ctx.fillStyle = `rgb(${pal.bg.join(',')})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  const cellSize = rng.int(8, 14);
  const cols = Math.ceil(SIZE / cellSize);
  const rows = Math.ceil(SIZE / cellSize);
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;
      const y = r * cellSize;
      const n = noise.noise2D(c * 0.02, r * 0.02);
      const density = (n + 1) / 2;
      
      if (density > 0.7) {
        ctx.fillStyle = `rgba(${pal.primary.join(',')}, ${(density - 0.7) * 1.5})`;
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      } else if (density > 0.5) {
        ctx.strokeStyle = `rgba(${pal.primary.join(',')}, ${(density - 0.5) * 0.8})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      }
    }
  }
}

function drawReceipt(ctx, rng, noise, pal) {
  ctx.fillStyle = `rgb(${pal.bg.join(',')})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  const bandCount = rng.int(40, 80);
  for (let i = 0; i < bandCount; i++) {
    const y = (i / bandCount) * SIZE;
    const n = noise.noise2D(i * 0.1, 0);
    const width = Math.abs(n) * SIZE * 0.8;
    const x = (SIZE - width) / 2;
    const alpha = rng.range(0.03, 0.15);
    ctx.fillStyle = `rgba(${pal.primary.join(',')}, ${alpha})`;
    ctx.fillRect(x, y, width, rng.range(1, 3));
  }
}

function drawPass(ctx, rng, noise, pal) {
  ctx.fillStyle = `rgb(${pal.bg.join(',')})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  const nodeCount = rng.int(8, 20);
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: rng.range(40, SIZE - 40),
      y: rng.range(40, SIZE - 40),
      r: rng.range(3, 12),
    });
  }
  
  // Connect nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const alpha = (1 - dist / 150) * 0.2;
        ctx.strokeStyle = `rgba(${pal.primary.join(',')}, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  
  // Draw nodes
  for (const node of nodes) {
    ctx.fillStyle = `rgba(${pal.secondary.join(',')}, 0.6)`;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const DRAW_FUNCTIONS = [drawIdentity, drawAttestation, drawCredential, drawReceipt, drawPass];

function generateArt(tokenId, tokenType, outputPath = null) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  
  const seed = hashSeed("etch-" + tokenId);
  const rng = new Rand(seed);
  const noise = new SimplexNoise(seed);
  const pal = PALETTES[tokenType] || PALETTES[0];
  const drawFn = DRAW_FUNCTIONS[tokenType] || DRAW_FUNCTIONS[0];
  
  drawFn(ctx, rng, noise, pal);
  
  if (outputPath) {
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Generated art for token #${tokenId} (type ${tokenType}) -> ${outputPath}`);
    return outputPath;
  } else {
    // Return as base64 data URI
    const buffer = canvas.toBuffer('image/png');
    const base64 = buffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node generate-art.js <tokenId> <tokenType> [outputPath]');
    console.error('Example: node generate-art.js 0 1 token-0.png');
    console.error('Example: node generate-art.js 0 1  (outputs base64 data URI)');
    process.exit(1);
  }
  
  const tokenId = parseInt(args[0]);
  const tokenType = parseInt(args[1]);
  const outputPath = args[2];
  
  if (isNaN(tokenId) || isNaN(tokenType)) {
    console.error('tokenId and tokenType must be numbers');
    process.exit(1);
  }
  
  const result = generateArt(tokenId, tokenType, outputPath);
  if (!outputPath) {
    console.log(result); // Print data URI
  }
}

module.exports = { generateArt };