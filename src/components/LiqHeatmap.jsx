import { useRef, useEffect, useMemo } from 'react';

const BG       = '#07090e';
const LONG_COL = [56, 189, 248];   // cyan — long liquidations
const SHORT_COL = [232, 121, 249]; // magenta — short liquidations

// Heat accumulation grid
const PRICE_BUCKETS  = 60;   // vertical buckets
const TIME_COLUMNS   = 80;   // horizontal time slots
const DECAY_RATE     = 0.97; // per-frame intensity decay (for fading)

function lerpColor([r1, g1, b1], [r2, g2, b2], t) {
  return `rgba(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)},${(0.15 + t * 0.85).toFixed(2)})`;
}

function fmtUsd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function LiqHeatmap({ liqs }) {
  const canvasRef = useRef(null);

  // Build a 2D grid: price bucket × time column → { longUsd, shortUsd }
  const grid = useMemo(() => {
    if (!liqs || liqs.length === 0) return null;

    const prices  = liqs.map(l => l.price);
    const minP    = Math.min(...prices);
    const maxP    = Math.max(...prices);
    const range   = maxP - minP || 1;

    const times   = liqs.map(l => l.time);
    const minT    = Math.min(...times);
    const maxT    = Math.max(...times);
    const rangeT  = maxT - minT || 1;

    const cells = Array.from({ length: TIME_COLUMNS }, () =>
      Array.from({ length: PRICE_BUCKETS }, () => ({ longUsd: 0, shortUsd: 0 }))
    );

    for (const l of liqs) {
      const px = Math.floor(((l.price - minP) / range) * (PRICE_BUCKETS - 1));
      const tx = Math.floor(((l.time  - minT) / rangeT) * (TIME_COLUMNS - 1));
      const cell = cells[tx]?.[px];
      if (!cell) continue;
      if (l.isLong)  cell.longUsd  += l.usdValue;
      else           cell.shortUsd += l.usdValue;
    }

    // Normalize
    let maxLong = 1, maxShort = 1;
    for (const col of cells) {
      for (const c of col) {
        if (c.longUsd  > maxLong)  maxLong  = c.longUsd;
        if (c.shortUsd > maxShort) maxShort = c.shortUsd;
      }
    }

    return { cells, minP, maxP, minT, maxT, maxLong, maxShort };
  }, [liqs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    if (!grid || !liqs?.length) {
      ctx.fillStyle = '#1a2535';
      ctx.font      = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting liquidations…', W / 2, H / 2);
      return;
    }

    const { cells, minP, maxP, minT, maxT, maxLong, maxShort } = grid;

    const cellW = W / TIME_COLUMNS;
    const cellH = H / PRICE_BUCKETS;

    for (let tx = 0; tx < TIME_COLUMNS; tx++) {
      for (let px = 0; px < PRICE_BUCKETS; px++) {
        const c = cells[tx][px];
        const x = tx * cellW;
        const y = (PRICE_BUCKETS - 1 - px) * cellH; // flip Y (price up = canvas up)

        if (c.longUsd > 0) {
          const t = Math.min(1, c.longUsd / maxLong);
          ctx.fillStyle = lerpColor([0, 30, 60], LONG_COL, t);
          ctx.fillRect(x, y, cellW, cellH);
        }
        if (c.shortUsd > 0) {
          const t = Math.min(1, c.shortUsd / maxShort);
          ctx.fillStyle = lerpColor([60, 0, 60], SHORT_COL, t);
          ctx.fillRect(x, y, cellW, cellH * 0.5);
        }
      }
    }

    // Price axis labels
    const AXIS_W = 44;
    ctx.fillStyle = 'rgba(7,9,14,0.75)';
    ctx.fillRect(W - AXIS_W, 0, AXIS_W, H);
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const frac  = i / steps;
      const price = minP + frac * (maxP - minP);
      const y     = H - frac * H;
      ctx.strokeStyle = '#0a1220';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - AXIS_W, y); ctx.stroke();
      ctx.fillStyle   = '#1e2d40';
      ctx.font        = '8px monospace';
      ctx.textAlign   = 'right';
      ctx.fillText(price.toFixed(0), W - 2, y + 3);
    }

    // Totals overlay
    const totalLong  = liqs.filter(l =>  l.isLong).reduce((s, l) => s + l.usdValue, 0);
    const totalShort = liqs.filter(l => !l.isLong).reduce((s, l) => s + l.usdValue, 0);
    ctx.font      = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgb(${LONG_COL.join(',')})`;
    ctx.fillText(`L ${fmtUsd(totalLong)}`, 4, 12);
    ctx.fillStyle = `rgb(${SHORT_COL.join(',')})`;
    ctx.fillText(`S ${fmtUsd(totalShort)}`, 4, 23);

  }, [grid, liqs]);

  return (
    <div style={{
      borderTop: '1px solid #0a1220',
      background: BG,
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: 4,
        fontSize: '7.5px', color: '#1a2535',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '1px', fontWeight: 600,
        pointerEvents: 'none', zIndex: 1,
      }}>
        LIQ HEATMAP
      </div>
      <div style={{
        position: 'absolute', top: 2, right: 50,
        fontSize: '7px', color: '#0d1825',
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: 'none', zIndex: 1,
        display: 'flex', gap: '6px',
      }}>
        <span style={{ color: `rgb(${LONG_COL.join(',')})` }}>■ LONG LIQ</span>
        <span style={{ color: `rgb(${SHORT_COL.join(',')})` }}>■ SHORT LIQ</span>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={56}
        style={{ display: 'block', width: '100%', height: '56px' }}
      />
    </div>
  );
}
