import { useMemo } from 'react';

// Finds pivot highs and lows, and detects if a recent candle "swept" them but closed back inside.
export function useLiquiditySweeps(klines) {
  return useMemo(() => {
    if (!klines || klines.length < 10) return [];
    
    const pivots = []; // { type: 'high'|'low', price: number, time: number, broken: false }
    const sweeps = []; // { type: 'sweep_high'|'sweep_low', price: number, time: number, pivotTime: number }

    const leftBars = 4;
    const rightBars = 2;

    // 1. Identify Pivots
    for (let i = leftBars; i < klines.length - rightBars; i++) {
      const c = klines[i];
      let isHigh = true;
      let isLow = true;

      // Check left and right to see if c is a local extremum
      for (let j = i - leftBars; j <= i + rightBars; j++) {
        if (i === j) continue;
        if (klines[j].h > c.h) isHigh = false;
        if (klines[j].l < c.l) isLow = false;
      }

      if (isHigh) pivots.push({ type: 'high', price: c.h, time: c.t, broken: false });
      if (isLow) pivots.push({ type: 'low', price: c.l, time: c.t, broken: false });
    }

    // 2. Identify Sweeps (Stop Hunts)
    // A sweep is when price pierces a pivot but closes back on the other side.
    for (let i = leftBars + 1; i < klines.length; i++) {
      const c = klines[i];

      for (const p of pivots) {
        if (p.time >= c.t || p.broken) continue; // Only look at past unbroken pivots

        if (p.type === 'high') {
          // Did we pierce the high?
          if (c.h > p.price) {
            // Did we close below it? (Sweep / Liquidity Grab)
            if (c.c < p.price && c.o < p.price) {
              sweeps.push({ type: 'sweep_high', price: c.h, pivotPrice: p.price, time: c.t, pivotTime: p.time });
              p.broken = true; // Consumed
            } else if (c.c > p.price) {
              // True breakout
              p.broken = true;
            }
          }
        }

        if (p.type === 'low') {
          // Did we pierce the low?
          if (c.l < p.price) {
            // Did we close above it? (Sweep / Liquidity Grab)
            if (c.c > p.price && c.o > p.price) {
              sweeps.push({ type: 'sweep_low', price: c.l, pivotPrice: p.price, time: c.t, pivotTime: p.time });
              p.broken = true; // Consumed
            } else if (c.c < p.price) {
              // True breakdown
              p.broken = true;
            }
          }
        }
      }
    }

    return { sweeps, activePivots: pivots.filter(p => !p.broken) };
  }, [klines]);
}
