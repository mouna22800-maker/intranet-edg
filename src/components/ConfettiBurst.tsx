/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

interface ConfettiBurstProps {
  /** Incrémentez cette valeur pour déclencher une nouvelle salve. */
  fire: number;
}

interface Piece {
  id: string;
  left: number;
  dx: number;
  rot: number;
  dur: number;
  delay: number;
  color: string;
  w: number;
}

const COLORS = ['#12A65A', '#34D98A', '#F3C40E', '#0B7A42', '#DDAE00', '#ffffff'];

export default function ConfettiBurst({ fire }: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!fire) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const N = 90;
    const arr: Piece[] = Array.from({ length: N }).map((_, i) => ({
      id: `${fire}-${i}`,
      left: Math.random() * 100,
      dx: (Math.random() * 2 - 1) * 180,
      rot: 360 + Math.random() * 720,
      dur: 2 + Math.random() * 1.6,
      delay: Math.random() * 0.25,
      color: COLORS[i % COLORS.length],
      w: 6 + Math.random() * 6,
    }));
    setPieces(arr);
    const t = setTimeout(() => setPieces([]), 4200);
    return () => clearTimeout(t);
  }, [fire]);

  if (pieces.length === 0) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="edg-confetti-piece"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            width: `${p.w}px`,
            height: `${p.w * 1.6}px`,
            ['--dx' as any]: `${p.dx}px`,
            ['--rot' as any]: `${p.rot}deg`,
            ['--dur' as any]: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
