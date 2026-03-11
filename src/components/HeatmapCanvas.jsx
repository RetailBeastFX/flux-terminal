import { useRef, useEffect, useCallback } from 'react';
import { BUCKET_SIZES } from '../utils.js';

const COL_WIDTH  = 2;
const PRICE_AXIS = 56;
const VP_WIDTH   = 48;
const BG_COLOR   = '#07090e';

// ── MMT-style neon spectral colors ─────────────────────────────────────────────
function bidColor(intensity) {
  // sqrt curve so mid-range walls are clearly visible
  const i = Math.pow(intensity, 0.55);
  if (i < 0.12) return `rgba(0,190,105,${(0.04 + i * 0.25).toFixed(3)})`;
  if (i < 0.35) return `rgba(0,235,115,${(0.12 + i * 0.45).toFixed(3)})`;
  if (i < 0.65) return `rgba(40,255,130,${(0.28 + i * 0.45).toFixed(3)})`;
  if (i < 0.88) return `rgba(130,255,175,${(0.52 + i * 0.28).toFixed(3)})`; // cyan-green
  return `rgba(210,255,220,0.92)`;  // near-white glow for extreme bid walls
}
function askColor(intensity) {
  const i = Math.pow(intensity, 0.55);
  if (i < 0.12) return `rgba(210,20,55,${(0.04 + i * 0.25).toFixed(3)})`;
  if (i < 0.35) return `rgba(250,25,60,${(0.12 + i * 0.45).toFixed(3)})`;
  if (i < 0.65) return `rgba(255,65,40,${(0.28 + i * 0.45).toFixed(3)})`;
  if (i < 0.88) return `rgba(255,150,35,${(0.52 + i * 0.28).toFixed(3)})`; // hot orange
  return `rgba(255,235,80,0.92)`;   // yellow glow for extreme ask walls
}
function tradeColor(b) { return b ? '#00ff99' : '#ff3060'; }

// ── Volume Profile ─────────────────────────────────────────────────────────────
function computeVP(frames, bucketSize) {
  const map = new Map();
  for (const f of frames) {
    for (const { p, q } of f.bids) {
      const bkt = Math.round(Math.floor(p / bucketSize) * bucketSize * 1e5) / 1e5;
      map.set(bkt, (map.get(bkt) || 0) + q);
    }
    for (const { p, q } of f.asks) {
      const bkt = Math.round(Math.floor(p / bucketSize) * bucketSize * 1e5) / 1e5;
      map.set(bkt, (map.get(bkt) || 0) + q);
    }
  }
  if (!map.size) return null;
  const sorted   = [...map.entries()].sort((a, b) => a[0] - b[0]);
  const totalVol = sorted.reduce((s, [, v]) => s + v, 0);
  const pocIdx   = sorted.reduce((bi, [, v], i) => v > sorted[bi][1] ? i : bi, 0);
  let lo = pocIdx, hi = pocIdx, acc = sorted[pocIdx][1];
  const target = totalVol * 0.70;
  while (acc < target && (lo > 0 || hi < sorted.length - 1)) {
    const upV = hi < sorted.length - 1 ? sorted[hi + 1][1] : -1;
    const dnV = lo > 0                 ? sorted[lo - 1][1] : -1;
    if (upV >= dnV) { hi++; acc += sorted[hi][1]; }
    else            { lo--; acc += sorted[lo][1]; }
  }
  return {
    sorted, maxVol: sorted[pocIdx][1],
    poc: sorted[pocIdx][0], vah: sorted[hi][0], val: sorted[lo][0],
  };
}

function drawTriangle(ctx, x, y, size, pointUp) {
  ctx.beginPath();
  if (pointUp) {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.87, y + size * 0.5);
    ctx.lineTo(x - size * 0.87, y + size * 0.5);
  } else {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size * 0.87, y - size * 0.5);
    ctx.lineTo(x - size * 0.87, y - size * 0.5);
  }
  ctx.closePath(); ctx.fill();
}

function fmtUsd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function HeatmapCanvas({ frames, tradeLog, liqs = [], symbol, alertPrices = [] }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const framesRef = useRef(frames);
  const tradesRef = useRef(tradeLog);
  const liqsRef   = useRef(liqs);
  const alertsRef = useRef(alertPrices);
  const sizeRef   = useRef({ W: 0, H: 0 });

  useEffect(() => { framesRef.current = frames;       }, [frames]);
  useEffect(() => { tradesRef.current = tradeLog;     }, [tradeLog]);
  useEffect(() => { liqsRef.current   = liqs;         }, [liqs]);
  useEffect(() => { alertsRef.current = alertPrices;  }, [alertPrices]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { W, H } = sizeRef.current;
    if (!W || !H) return;

    const ctx    = canvas.getContext('2d');
    const frames = framesRef.current;
    const trades = tradesRef.current;
    const liqs   = liqsRef.current;
    const alerts = alertsRef.current;
    const bs     = BUCKET_SIZES[symbol] || 1;

    if (!frames.length) {
      ctx.fillStyle = BG_COLOR; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1a2535'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('Connecting…', W / 2, H / 2);
      return;
    }

    // ── Price range ───────────────────────────────────────────────────────────
    const recent = frames.slice(-80);
    let pMin = Infinity, pMax = -Infinity;
    for (const f of recent) {
      for (const { p } of f.bids) pMin = Math.min(pMin, p);
      for (const { p } of f.asks) pMax = Math.max(pMax, p);
    }
    if (!isFinite(pMin) || pMax <= pMin) return;
    const pad    = (pMax - pMin) * 0.18;
    pMin -= pad; pMax += pad;
    const pRange = pMax - pMin;

    const chartW  = W - PRICE_AXIS;
    const numCols = Math.floor(chartW / COL_WIDTH);
    const vis     = frames.slice(-numCols);

    // Max quantity for normalization (log-scaled for better range)
    let maxQ = 0.001;
    for (const f of vis) {
      for (const { q } of f.bids) maxQ = Math.max(maxQ, q);
      for (const { q } of f.asks) maxQ = Math.max(maxQ, q);
    }

    const vp = computeVP(vis, bs);

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = BG_COLOR; ctx.fillRect(0, 0, W, H);

    // ── Grid ──────────────────────────────────────────────────────────────────
    const step = Math.ceil(pRange / 8 / bs) * bs;
    const gs   = Math.ceil(pMin / step) * step;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    for (let p = gs; p <= pMax; p += step) {
      const y = py(p, pMin, pRange, H);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
    }
    ctx.restore();

    // ── Depth columns (MMT neon style) ────────────────────────────────────────
    const barH = Math.max(3, Math.ceil(H / ((pMax - pMin) / bs)));
    vis.forEach((frame, i) => {
      const x = i * COL_WIDTH;
      for (const { p, q } of frame.bids) {
        const intens = q / maxQ;
        const y      = py(p, pMin, pRange, H);
        ctx.fillStyle = bidColor(intens);
        ctx.fillRect(x, y - barH * 0.5, COL_WIDTH, barH);
        // Bloom for large walls
        if (intens > 0.82) {
          ctx.fillStyle = 'rgba(60,255,140,0.07)';
          ctx.fillRect(x - 2, y - barH * 1.5, COL_WIDTH + 4, barH * 3);
        }
      }
      for (const { p, q } of frame.asks) {
        const intens = q / maxQ;
        const y      = py(p, pMin, pRange, H);
        ctx.fillStyle = askColor(intens);
        ctx.fillRect(x, y - barH * 0.5, COL_WIDTH, barH);
        if (intens > 0.82) {
          ctx.fillStyle = 'rgba(255,180,0,0.07)';
          ctx.fillRect(x - 2, y - barH * 1.5, COL_WIDTH + 4, barH * 3);
        }
      }
    });

    // ── Volume Profile overlay ────────────────────────────────────────────────
    if (vp) {
      const vpX    = chartW - VP_WIDTH;
      const maxBar = VP_WIDTH - 4;
      const rowH   = vp.sorted.length > 1
        ? Math.abs(py(vp.sorted[1][0], pMin, pRange, H) - py(vp.sorted[0][0], pMin, pRange, H))
        : 4;

      const vahY = py(vp.vah + bs, pMin, pRange, H);
      const valY = py(vp.val,      pMin, pRange, H);
      ctx.fillStyle = 'rgba(59,130,246,0.06)';
      ctx.fillRect(vpX, vahY, VP_WIDTH, valY - vahY);

      for (const [price, vol] of vp.sorted) {
        const y    = py(price, pMin, pRange, H);
        const barW = Math.max(1, (vol / vp.maxVol) * maxBar);
        const isPoc = price === vp.poc;
        const inVA  = price >= vp.val && price <= vp.vah;
        ctx.fillStyle = isPoc ? 'rgba(251,191,36,0.75)' : inVA ? 'rgba(59,130,246,0.40)' : 'rgba(100,120,160,0.18)';
        ctx.fillRect(vpX, y - rowH * 0.5, barW, Math.max(1.5, rowH * 0.9));
      }

      const pocY    = py(vp.poc, pMin, pRange, H);
      const vahLineY = py(vp.vah, pMin, pRange, H);
      const valLineY = py(vp.val, pMin, pRange, H);

      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(251,191,36,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, pocY); ctx.lineTo(vpX, pocY); ctx.stroke();
      ctx.strokeStyle = 'rgba(59,130,246,0.35)';
      ctx.beginPath(); ctx.moveTo(0, vahLineY); ctx.lineTo(vpX, vahLineY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, valLineY); ctx.lineTo(vpX, valLineY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.font = '7.5px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(251,191,36,0.9)';   ctx.fillText('POC', vpX + 1, pocY - 5);
      if (Math.abs(vahLineY - pocY) > 12) { ctx.fillStyle = 'rgba(100,149,237,0.8)'; ctx.fillText('VAH', vpX + 1, vahLineY - 5); }
      if (Math.abs(valLineY - pocY) > 12) { ctx.fillStyle = 'rgba(100,149,237,0.8)'; ctx.fillText('VAL', vpX + 1, valLineY + 5); }
    }

    // ── Alert price lines ─────────────────────────────────────────────────────
    if (alerts.length > 0) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.font = '8.5px "JetBrains Mono", monospace'; ctx.textBaseline = 'middle';
      for (const al of alerts) {
        const y = py(al.price, pMin, pRange, H);
        if (y < 0 || y > H) continue;
        const col = al.triggered ? 'rgba(251,191,36,0.9)' : 'rgba(200,120,255,0.75)';
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW - VP_WIDTH, y); ctx.stroke();
        ctx.fillStyle  = col; ctx.textAlign = 'left';
        ctx.fillText(`⚑ ${al.price.toLocaleString()}`, 8, y - 6);
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Mid-price line ────────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.70)'; ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    vis.forEach((frame, i) => {
      if (frame.midPrice == null) return;
      const x = i * COL_WIDTH + 1;
      const y = py(frame.midPrice, pMin, pRange, H);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // ── Trade dots ────────────────────────────────────────────────────────────
    if (vis.length > 1) {
      const t0 = vis[0].ts, t1 = vis[vis.length - 1].ts;
      const tr = Math.max(t1 - t0, 1);
      ctx.save(); ctx.globalAlpha = 0.80;
      for (const t of trades) {
        if (t.time < t0 || t.time > t1) continue;
        const x = ((t.time - t0) / tr) * (chartW - VP_WIDTH);
        const y = py(t.price, pMin, pRange, H);
        const r = Math.min(Math.sqrt(t.qty) * 0.8 + 1.2, 6);
        ctx.fillStyle = tradeColor(t.isBuy);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.restore();
    }

    // ── Liquidation markers ───────────────────────────────────────────────────
    if (vis.length > 1 && liqs.length > 0) {
      const t0 = vis[0].ts, t1 = vis[vis.length - 1].ts;
      const tr = Math.max(t1 - t0, 1);
      const now = Date.now();
      ctx.save();
      for (const liq of liqs) {
        if (liq.time < t0 || liq.time > t1) continue;
        const x    = ((liq.time - t0) / tr) * (chartW - VP_WIDTH);
        const y    = py(liq.price, pMin, pRange, H);
        const usd  = liq.usdValue;
        const size = Math.max(3, Math.min(13, Math.sqrt(usd / 2500)));
        const fade = Math.max(0.05, 1 - (now - liq.time) / 120_000);
        ctx.fillStyle = liq.isLong ? `rgba(232,60,160,${fade})` : `rgba(50,225,225,${fade})`;
        drawTriangle(ctx, x, y, size, !liq.isLong);
        if (usd >= 100_000) {
          ctx.strokeStyle = liq.isLong ? `rgba(232,60,160,${fade * 0.5})` : `rgba(50,225,225,${fade * 0.5})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, size + 4, 0, Math.PI * 2); ctx.stroke();
        }
        if (usd >= 250_000) {
          ctx.fillStyle = liq.isLong ? `rgba(255,110,200,${fade})` : `rgba(100,245,245,${fade})`;
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = liq.isLong ? 'bottom' : 'top';
          ctx.fillText(`${liq.isLong ? '▼' : '▲'} ${fmtUsd(usd)}`, x, liq.isLong ? y + size + 12 : y - size - 12);
        }
      }
      ctx.restore();

      // Recent liq ticker
      const now2     = Date.now();
      const recent30 = liqs.filter(l => now2 - l.time < 30_000 && l.usdValue >= 25_000).slice(0, 5);
      if (recent30.length > 0) {
        ctx.save();
        let tickY = 24;
        ctx.font = '9px "JetBrains Mono", monospace'; ctx.textBaseline = 'top';
        for (const l of recent30) {
          const fade = Math.max(0.1, 1 - (now2 - l.time) / 30_000);
          ctx.fillStyle  = l.isLong ? `rgba(232,60,160,${fade})` : `rgba(50,225,225,${fade})`;
          ctx.textAlign = 'left';
          ctx.fillText(`${l.isLong ? '▼ LONG' : '▲ SHORT'} ${fmtUsd(l.usdValue)}`, 10, tickY);
          tickY += 13;
        }
        ctx.restore();
      }
    }

    // ── Price axis ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#0b0e17'; ctx.fillRect(chartW, 0, PRICE_AXIS, H);
    ctx.strokeStyle = '#0f1520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(chartW, 0); ctx.lineTo(chartW, H); ctx.stroke();

    ctx.fillStyle = '#1e2d40'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '9px "JetBrains Mono", monospace';
    for (let p = gs; p <= pMax; p += step) {
      const y = py(p, pMin, pRange, H);
      if (y < 8 || y > H - 8) continue;
      ctx.fillText(fmtP(p, symbol), W - 4, y);
    }

    const last = frames[frames.length - 1];
    if (last?.midPrice) {
      const y = py(last.midPrice, pMin, pRange, H);
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath(); ctx.roundRect(chartW + 2, y - 8, PRICE_AXIS - 4, 16, 2); ctx.fill();
      ctx.fillStyle = '#93c5fd'; ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.fillText(fmtP(last.midPrice, symbol), W - 4, y);
    }

    ctx.fillStyle = '#1a2535'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '8.5px "JetBrains Mono", monospace';
    ctx.fillText('HEATMAP · DEPTH HISTORY', 10, 9);
  }, [symbol]);

  useEffect(() => {
    let alive = true;
    const loop = () => { if (!alive) return; render(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(animRef.current); };
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ro  = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width: W, height: H } = e.contentRect;
        if (!W || !H) continue;
        sizeRef.current = { W, H };
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

const py    = (price, pMin, pRange, H) => H - ((price - pMin) / pRange) * H;
function fmtP(p, sym) {
  const d = sym?.includes('DOGE') ? 5 : sym?.includes('ADA') || sym?.includes('XRP') ? 4 : sym?.includes('LINK') || sym?.includes('DOT') ? 3 : sym?.includes('SOL') || sym?.includes('BNB') || sym?.includes('AVAX') ? 2 : 0;
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
