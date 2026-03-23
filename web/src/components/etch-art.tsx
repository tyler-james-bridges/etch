'use client';

import { useEffect, useRef } from 'react';
import { renderEtchArt } from '@/lib/art-engine';

interface EtchArtProps {
  tokenId: number;
  tokenType: number;
  size?: number;
}

export function EtchArt({ tokenId, tokenType, size = 400 }: EtchArtProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate deterministic art from tokenId
    renderEtchArt(ctx, tokenId, tokenType, size);
  }, [tokenId, tokenType, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="border-2 border-black"
      style={{
        imageRendering: 'pixelated',
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  );
}