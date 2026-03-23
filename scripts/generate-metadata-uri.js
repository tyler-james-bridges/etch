#!/usr/bin/env node
// Generate optimized SVG metadata data URI for onchain minting
// Uses feTurbulence for noise texture instead of thousands of rects

const SIZE = 400;

const PALETTES = {
  0: { bg: [6,10,20], primary: [96,165,250], secondary: [147,197,253], dim: [30,58,138] },
  1: { bg: [6,16,10], primary: [34,197,94], secondary: [134,239,172], dim: [20,83,45] },
  2: { bg: [12,8,24], primary: [167,139,250], secondary: [196,181,253], dim: [76,29,149] },
  3: { bg: [16,12,4], primary: [251,146,60], secondary: [253,186,116], dim: [124,45,18] },
  4: { bg: [6,16,20], primary: [34,211,238], secondary: [103,232,249], dim: [14,116,144] },
};

class SimplexNoise {
  constructor(seed) {
    this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  noise2D(x, y) {
    const F2 = 0.5*(Math.sqrt(3)-1), G2 = (3-Math.sqrt(3))/6;
    const s = (x+y)*F2, i = Math.floor(x+s), j = Math.floor(y+s), t = (i+j)*G2;
    const x0 = x-(i-t), y0 = y-(j-t);
    const i1 = x0>y0?1:0, j1 = x0>y0?0:1;
    const x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255, dot=(g,x,y)=>g[0]*x+g[1]*y;
    let n0=0,n1=0,n2=0;
    let t0=0.5-x0*x0-y0*y0; if(t0>0){t0*=t0;n0=t0*t0*dot(this.grad3[this.perm[ii+this.perm[jj]]%12],x0,y0);}
    let t1=0.5-x1*x1-y1*y1; if(t1>0){t1*=t1;n1=t1*t1*dot(this.grad3[this.perm[ii+i1+this.perm[jj+j1]]%12],x1,y1);}
    let t2=0.5-x2*x2-y2*y2; if(t2>0){t2*=t2;n2=t2*t2*dot(this.grad3[this.perm[ii+1+this.perm[jj+1]]%12],x2,y2);}
    return 70*(n0+n1+n2);
  }
}

class Rand {
  constructor(seed) { this.s = seed; }
  next() { this.s = (this.s * 16807) % 2147483647; return this.s / 2147483647; }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b)); }
  pick(arr) { return arr[this.int(0, arr.length)]; }
}

function hashSeed(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return Math.abs(h) || 1; }
function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function f(n) { return n.toFixed(1); }

// Optimized SVG generators - use feTurbulence for noise, fewer elements

function drawIdentity(rng, noise, pal) {
  const cx = 200, cy = 200;
  const layers = rng.int(6, 12);
  const baseRot = rng.range(0, Math.PI);
  const sym = rng.pick([3, 4, 5, 6, 8]);
  const seed = rng.int(1, 999);

  let defs = `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="${seed}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.06" intercept="0"/></feComponentTransfer></filter>`;
  defs += `<radialGradient id="g" cx=".5" cy=".5" r=".125"><stop offset="0" stop-color="${rgb(pal.primary)}" stop-opacity=".6"/><stop offset=".5" stop-color="${rgb(pal.primary)}" stop-opacity=".1"/><stop offset="1" stop-color="${rgb(pal.primary)}" stop-opacity="0"/></radialGradient>`;

  let els = `<rect width="400" height="400" fill="${rgb(pal.bg)}"/>`;
  els += `<rect width="400" height="400" filter="url(#n)" fill="${rgb(pal.primary)}" opacity=".15"/>`;

  for (let l = 0; l < layers; l++) {
    const radius = 30 + l * (160 / layers);
    const rot = baseRot + l * rng.range(0.05, 0.3);
    const alpha = (0.1 + (l / layers) * 0.5).toFixed(2);
    const lw = (0.5 + (l / layers) * 1.5).toFixed(1);
    let d = '';
    for (let i = 0; i < sym; i++) {
      const a = rot + (i / sym) * Math.PI * 2;
      const nr = radius + noise.noise2D(a * 2, l * 0.5) * 15;
      d += `${i === 0 ? 'M' : 'L'}${f(cx + Math.cos(a) * nr)} ${f(cy + Math.sin(a) * nr)} `;
    }
    els += `<path d="${d}Z" fill="none" stroke="${rgb(pal.primary)}" stroke-width="${lw}" opacity="${alpha}"/>`;

    if (l > 1 && rng.next() > 0.3) {
      const pr = 30 + (l - 1) * (160 / layers);
      for (let i = 0; i < sym; i++) {
        const a = rot + (i / sym) * Math.PI * 2;
        els += `<line x1="${f(cx + Math.cos(a) * pr)}" y1="${f(cy + Math.sin(a) * pr)}" x2="${f(cx + Math.cos(a) * radius)}" y2="${f(cy + Math.sin(a) * radius)}" stroke="${rgb(pal.dim)}" stroke-width=".3" opacity="${(alpha * 0.5).toFixed(2)}"/>`;
      }
    }
  }

  els += `<circle cx="200" cy="200" r="50" fill="url(#g)"/>`;

  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(10, 180);
    const al = (rng.range(0.05, 0.4) * (1 - d / 200)).toFixed(2);
    els += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${f(rng.range(0.5, 2.5))}" fill="${rgb(pal.secondary)}" opacity="${al}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><defs>${defs}</defs>${els}</svg>`;
}

function drawAttestation(rng, noise, pal) {
  const scale = rng.range(0.002, 0.006);
  const strength = rng.range(2, 5);
  const particles = rng.int(60, 100);
  const steps = rng.int(40, 70);
  const offset = rng.range(0, 100);

  let els = `<rect width="400" height="400" fill="${rgb(pal.bg)}"/>`;

  for (let p = 0; p < particles; p++) {
    let x = rng.range(0, SIZE), y = rng.range(0, SIZE);
    const hs = rng.next();
    const la = rng.range(0.03, 0.15).toFixed(3);
    const lw = rng.range(0.3, 1.5).toFixed(1);
    const color = hs > 0.7 ? pal.secondary : hs > 0.3 ? pal.primary : pal.dim;
    let d = `M${f(x)} ${f(y)}`;
    for (let s = 0; s < steps; s++) {
      const angle = noise.noise2D(x * scale + offset, y * scale + offset) * Math.PI * strength;
      x += Math.cos(angle) * 2; y += Math.sin(angle) * 2;
      d += ` L${f(x)} ${f(y)}`;
      if (x < -20 || x > 420 || y < -20 || y > 420) break;
    }
    els += `<path d="${d}" fill="none" stroke="${rgb(color)}" stroke-width="${lw}" opacity="${la}"/>`;
  }

  let defs = '';
  for (let i = 0; i < rng.int(2, 5); i++) {
    const nx = rng.range(50, 350), ny = rng.range(50, 350), nr = rng.range(15, 40);
    const id = `g${i}`;
    defs += `<radialGradient id="${id}" cx="${(nx/400).toFixed(3)}" cy="${(ny/400).toFixed(3)}" r="${(nr/400).toFixed(3)}" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${rgb(pal.primary)}" stop-opacity=".3"/><stop offset="1" stop-color="${rgb(pal.primary)}" stop-opacity="0"/></radialGradient>`;
    els += `<circle cx="${f(nx)}" cy="${f(ny)}" r="${f(nr)}" fill="url(#${id})"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${defs ? '<defs>' + defs + '</defs>' : ''}${els}</svg>`;
}

function drawCredential(rng, noise, pal) {
  const cellSize = rng.int(10, 16);
  const cols = Math.ceil(400 / cellSize), rows = Math.ceil(400 / cellSize);
  const ns = rng.range(0.015, 0.04);
  const seed = rng.int(1, 999);

  let els = `<rect width="400" height="400" fill="${rgb(pal.bg)}"/>`;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize, y = r * cellSize;
      const density = (noise.noise2D(c * ns, r * ns) + 1) / 2;
      if (density > 0.7) els += `<rect x="${x+1}" y="${y+1}" width="${cellSize-2}" height="${cellSize-2}" fill="${rgb(pal.primary)}" opacity="${((density-.7)*1.5).toFixed(2)}"/>`;
      else if (density > 0.55) els += `<rect x="${x+1}" y="${y+1}" width="${cellSize-2}" height="${cellSize-2}" fill="none" stroke="${rgb(pal.primary)}" stroke-width=".5" opacity="${((density-.55)*.8).toFixed(2)}"/>`;
    }
  }

  let defs = '';
  for (let i = 0; i < rng.int(3, 8); i++) {
    const x = rng.range(20, 380), y = rng.range(20, 380), rad = rng.range(8, 24);
    const id = `g${i}`;
    defs += `<radialGradient id="${id}" cx="${(x/400).toFixed(3)}" cy="${(y/400).toFixed(3)}" r="${(rad/400).toFixed(3)}" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${rgb(pal.secondary)}" stop-opacity=".5"/><stop offset="1" stop-color="${rgb(pal.secondary)}" stop-opacity="0"/></radialGradient>`;
    els += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="url(#${id})"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${defs ? '<defs>' + defs + '</defs>' : ''}${els}</svg>`;
}

function drawReceipt(rng, noise, pal) {
  let els = `<rect width="400" height="400" fill="${rgb(pal.bg)}"/>`;
  const bandCount = rng.int(30, 60);
  for (let i = 0; i < bandCount; i++) {
    const y = (i / bandCount) * 400;
    const n = noise.noise2D(i * 0.1, 0);
    const width = Math.abs(n) * 320;
    els += `<rect x="${f((400-width)/2 + noise.noise2D(0, i*0.1)*40)}" y="${f(y)}" width="${f(width)}" height="${f(rng.range(1,3))}" fill="${rgb(n>0?pal.primary:pal.dim)}" opacity="${rng.range(.03,.15).toFixed(3)}"/>`;
  }
  for (let i = 0; i < rng.int(15, 30); i++) {
    const x = rng.range(20, 380), y1 = rng.range(10, 390);
    els += `<line x1="${f(x)}" y1="${f(y1)}" x2="${f(x)}" y2="${f(y1+rng.range(5,40))}" stroke="${rgb(pal.primary)}" stroke-width="1" opacity="${rng.range(.1,.35).toFixed(2)}"/>`;
  }
  for (let i = 0; i < rng.int(2, 4); i++) {
    const x = rng.range(30, 120), y = rng.range(30, 300), w = rng.range(120, 240), h = rng.range(30, 80);
    els += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${rgb(pal.primary)}" stroke-width="1" opacity="${rng.range(.08,.25).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${els}</svg>`;
}

function drawPass(rng, noise, pal) {
  const nodeCount = rng.int(6, 14);
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) nodes.push({ x: rng.range(40, 360), y: rng.range(40, 360), r: rng.range(3, 12), energy: rng.range(0.3, 1) });

  let els = `<rect width="400" height="400" fill="${rgb(pal.bg)}"/>`;
  let defs = '';
  let dc = 0;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (dist < rng.range(100, 200)) {
        const alpha = ((1 - dist/200) * 0.3 * nodes[i].energy).toFixed(3);
        const mx = (nodes[i].x+nodes[j].x)/2 + noise.noise2D(i,j)*30;
        const my = (nodes[i].y+nodes[j].y)/2 + noise.noise2D(j,i)*30;
        els += `<path d="M${f(nodes[i].x)} ${f(nodes[i].y)} Q${f(mx)} ${f(my)} ${f(nodes[j].x)} ${f(nodes[j].y)}" fill="none" stroke="${rgb(pal.primary)}" stroke-width="${rng.range(.3,1.5).toFixed(1)}" opacity="${alpha}"/>`;
      }
    }
  }

  for (const node of nodes) {
    for (let r = 0; r < rng.int(5, 15); r++) {
      const angle = rng.range(0, Math.PI*2), len = rng.range(15, 60)*node.energy;
      els += `<line x1="${f(node.x)}" y1="${f(node.y)}" x2="${f(node.x+Math.cos(angle)*len)}" y2="${f(node.y+Math.sin(angle)*len)}" stroke="${rgb(pal.primary)}" stroke-width=".5" opacity="${rng.range(.03,.15).toFixed(2)}"/>`;
    }
    const id = `g${dc++}`;
    defs += `<radialGradient id="${id}" cx="${(node.x/400).toFixed(3)}" cy="${(node.y/400).toFixed(3)}" r="${(node.r*3/400).toFixed(3)}" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${rgb(pal.primary)}" stop-opacity="${(.5*node.energy).toFixed(2)}"/><stop offset=".5" stop-color="${rgb(pal.primary)}" stop-opacity="${(.1*node.energy).toFixed(2)}"/><stop offset="1" stop-color="${rgb(pal.primary)}" stop-opacity="0"/></radialGradient>`;
    els += `<circle cx="${f(node.x)}" cy="${f(node.y)}" r="${f(node.r*3)}" fill="url(#${id})"/>`;
    els += `<circle cx="${f(node.x)}" cy="${f(node.y)}" r="${f(node.r*.4)}" fill="${rgb(pal.secondary)}" opacity="${(.6*node.energy).toFixed(2)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${defs ? '<defs>' + defs + '</defs>' : ''}${els}</svg>`;
}

const DRAW = [drawIdentity, drawAttestation, drawCredential, drawReceipt, drawPass];
const TYPE_LABELS = ["Identity", "Attestation", "Credential", "Receipt", "Pass"];

function generateMetadataUri(tokenId, tokenType, description) {
  const seed = hashSeed("etch-" + tokenId);
  const rng = new Rand(seed);
  const noise = new SimplexNoise(seed);
  const svg = DRAW[tokenType](rng, noise, PALETTES[tokenType]);
  const svgBase64 = Buffer.from(svg).toString('base64');

  const metadata = JSON.stringify({
    name: `ETCH #${tokenId}`,
    description: description || `Onchain ${TYPE_LABELS[tokenType]} record on Abstract.`,
    image: `data:image/svg+xml;base64,${svgBase64}`,
    attributes: [
      { trait_type: "Type", value: TYPE_LABELS[tokenType] },
      { trait_type: "Soulbound", value: "Yes" },
    ],
  });

  const metaBase64 = Buffer.from(metadata).toString('base64');
  return `data:application/json;base64,${metaBase64}`;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node generate-metadata-uri.js <tokenId> <tokenType> [description]');
    process.exit(1);
  }
  const tokenId = parseInt(args[0]);
  const tokenType = parseInt(args[1]);
  const desc = args.slice(2).join(' ') || undefined;
  const uri = generateMetadataUri(tokenId, tokenType, desc);
  
  // Also write SVG standalone for preview
  const seed = hashSeed("etch-" + tokenId);
  const rng = new Rand(seed);
  const noise = new SimplexNoise(seed);
  const svg = DRAW[tokenType](rng, noise, PALETTES[tokenType]);
  
  console.log('SVG size:', svg.length, 'bytes');
  console.log('URI size:', uri.length, 'bytes');
  console.log('URI size (KB):', (uri.length / 1024).toFixed(1));
  
  // Write URI to file
  const fs = require('fs');
  fs.writeFileSync(`/tmp/etch-token-${tokenId}-uri.txt`, uri);
  fs.writeFileSync(`/tmp/etch-token-${tokenId}.svg`, svg);
  console.log(`Written to /tmp/etch-token-${tokenId}-uri.txt and /tmp/etch-token-${tokenId}.svg`);
}

module.exports = { generateMetadataUri };
