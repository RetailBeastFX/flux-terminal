import { useRef, useEffect } from 'react';

const BG    = '#07090e';
const BULL  = '#00e57a';    // green — net buy
const BEAR  = '#f0304a';    // red   — net sell
const ZERO  = '#1a2535';

// Format large USD values
function fmtUsd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function DeltaCanvas({ buckets }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    if (!buckets || buckets.length < 2) {
      ctx.fillStyle = '#1a2535';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Accumulating delta…', W / 2, H / 2);
      return;
    }

    const LABEL_H  = 14;
    const drawH    = H - LABEL_H;
    const n        = buckets.length;
    const barW     = Math.max(2, Math.floor((W - 2) / n) - 1);
    const maxDelta = buckets.reduce((m, b) => Math.max(m, Math.abs(b.delta)), 1);
    const halfH    = drawH / 2;
    const midY     = halfH;

    // Zero line
    ctx.strokeStyle = ZERO;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(W, midY);
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const b    = buckets[i];
      const x    = i * (barW + 1) + 1;
      const ratio = Math.min(1, Math.abs(b.delta) / maxDelta);
      const barH  = Math.max(1, ratio * halfH * 0.92);

      const isBull = b.delta >= 0;

      // Main bar
      ctx.fillStyle = isBull ? BULL : BEAR;
      ctx.globalAlpha = 0.55 + ratio * 0.45;
      if (isBull) {
        ctx.fillRect(x, midY - barH, barW, barH);
      } else {
        ctx.fillRect(x, midY, barW, barH);
      }
      ctx.globalAlpha = 1;

      // Accent edge
      ctx.fillStyle = isBull
        ? `rgba(0, 255, 140, ${0.3 + ratio * 0.6})`
        : `rgba(255, 50, 70, ${0.3 + ratio * 0.6})`;
      if (isBull) {
        ctx.fillRect(x, midY - barH, barW, 1);
      } else {
        ctx.fillRect(x, midY + barH - 1, barW, 1);
      }

      // Big trade spike indicator
      const bigThreshold = 50_000; // $50K
      if (b.bigBuy > bigThreshold || b.bigSell > bigThreshold) {
        const hasBigBuy  = b.bigBuy  > bigThreshold;
        const hasBigSell = b.bigSell > bigThreshold;
        if (hasBigBuy) {
          ctx.fillStyle = 'rgba(0,255,160,0.9)';
          ctx.fillRect(x, midY - barH - 3, barW, 2);
        }
        if (hasBigSell) {
          ctx.fillStyle = 'rgba(255,80,80,0.9)';
          ctx.fillRect(x, midY + barH + 1, barW, 2);
        }
      }
    }

    // Latest delta label
    const last = buckets[buckets.length - 1];
    if (last) {
      const isBull   = last.delta >= 0;
      const labelTxt = (isBull ? '▲ ' : '▼ ') + fmtUsd(Math.abs(last.delta));
      ctx.font      = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = isBull ? '#00e57a' : '#f0304a';
      ctx.fillText(labelTxt, W - 4, LABEL_H - 3 + drawH);

      // Volume label
      ctx.fillStyle = '#2d3f54';
      ctx.textAlign = 'left';
      ctx.fillText(`VOL ${fmtUsd(last.buyUsd + last.sellUsd)}`, 4, LABEL_H - 3 + drawH);
    }

    // Y-axis ticks
    ctx.fillStyle = '#1e2f40';
    ctx.font      = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(fmtUsd(maxDelta), W - 2, 9);
    ctx.fillText(fmtUsd(maxDelta), W - 2, drawH - 2);

  }, [buckets]);

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
        pointerEvents: 'none',
      }}>
        ΔFLOW
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={52}
        style={{ display: 'block', width: '100%', height: '52px' }}
      />
    </div>
  );
}
