'use client';

import { useMemo } from 'react';
import { generateEtchSvg } from '@/lib/art-svg';

interface EtchArtProps {
  tokenId: number;
  tokenType: number;
  size?: number;
}

export function EtchArt({ tokenId, tokenType, size = 400 }: EtchArtProps) {
  const svg = useMemo(() => generateEtchSvg(tokenId, tokenType), [tokenId, tokenType]);

  return (
    <div
      className="border-2 border-black"
      style={{ width: size, maxWidth: '100%' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
