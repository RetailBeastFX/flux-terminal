import { useRef, useEffect, useCallback } from 'react';
import { BUCKET_SIZES } from '../utils.js';

// ── Layout constants (all CSS px) ─────────────────────────────────────────────
const CANDLE_W      = 72;   // total column width per candle
const CANDLE_GAP    = 2;    // gap between columns
const PRICE_AXIS_W  = 60;   // right-side price axis
const TIME_AXIS_H   = 20;   // bottom time axis
const BAR_MAX_HALF  = 28;   // max half-width of buy/sell bars (px)
const BODY_W        = 5;    // ohlc candle body width
const BG            = '#07090e';
const GRID_CLR      = 'rgba(255,255,255,0.03)';
const PANEL_LABEL   = '8.5px "JetBrains Mono", monospace';

const BUY_CLR_BASE  = [34, 211, 160];
const SELL_CLR_BASE = [248, 113, 113];
const DELTA_POS_CLR = '#22d3a0';
const DELTA_NEG_CLR = '#f87171';
const NEUTRAL_CLR   = '#1e2d40';

function rgba([r, g, b], a) { return `rgba(${r},${g},${b},${a})`; }

// ── Footprint Canvas ──────────────────────────────────────────────────────────
export function FootprintCanvas({ footprint, symbol }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const dataRef   = useRef(footprint);
  const sizeRef   = useRef({ W: 0, H: 0 });

  useEffect(() => { dataRef.current = footprint; }, [footprint]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { W, H } = sizeRef.current;
    if (!W || !H) return;

    const ctx    = canvas.getContext('2d');
    const data   = dataRef.current;
    const chartW = W - PRICE_AXIS_W;
    const chartH = H - TIME_AXIS_H;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    if (!data.length) {
      ctx.fillStyle = '#1a2535';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('Accumulating trade data…  (takes ~30s)', W / 2, chartH / 2);
      return;
    }

    // ── How many candles fit? ────────────────────────────────────────────────
    const colStride  = CANDLE_W + CANDLE_GAP;
    const maxVisible = Math.floor(chartW / colStride);
    const visible    = data.slice(-maxVisible);

    // ── Price range across visible candles ───────────────────────────────────
    let pMin = Infinity, pMax = -Infinity;
    for (const c of visible) {
      for (const price of c.levels.keys()) {
        pMin = Math.min(pMin, price);
        pMax = Math.max(pMax, price);
      }
      if (c.kline) { pMin = Math.min(pMin, c.kline.l); pMax = Math.max(pMax, c.kline.h); }
    }
    if (!isFinite(pMin) || pMax <= pMin) return;

    const bs   = BUCKET_SIZES[symbol] || 1;
    const pad  = bs * 3;
    pMin -= pad; pMax += pad;
    const pRange = pMax - pMin;

    // ── Max volume across all levels for normalizing bar widths ─────────────
    let maxLvlVol = 0.001;
    for (const c of visible) {
      for (const { buy, sell } of c.levels.values()) {
        maxLvlVol = Math.max(maxLvlVol, buy, sell);
      }
    }

    // ── Grid lines ────────────────────────────────────────────────────────────
    const gridStep  = Math.ceil(pRange / 8 / bs) * bs;
    const gridStart = Math.ceil(pMin / gridStep) * gridStep;
    ctx.save();
    ctx.strokeStyle = GRID_CLR; ctx.lineWidth = 1;
    for (let p = gridStart; p <= pMax; p += gridStep) {
      const y = py(p, pMin, pRange, chartH);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke();
    }
    ctx.restore();

    // ── Render each candle column ─────────────────────────────────────────────
    visible.forEach((candle, ci) => {
      const x0 = ci * colStride; // left edge of this column

      // ── Column background (alternating) ──────────────────────────────────
      if (ci % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.012)';
        ctx.fillRect(x0, 0, CANDLE_W, chartH);
      }

      // ── Per-level buy/sell bars ───────────────────────────────────────────
      const cx = x0 + CANDLE_W / 2; // column center X

      for (const [price, { buy, sell, delta }] of candle.levels) {
        const y      = py(price, pMin, pRange, chartH);
        const rowH   = Math.max(2, py(price - bs, pMin, pRange, chartH) - y - 0.5);

        const buyW   = (buy / maxLvlVol) * BAR_MAX_HALF;
        const sellW  = (sell / maxLvlVol) * BAR_MAX_HALF;

        // Sell bar (left of center, red)
        if (sellW > 0.5) {
          const sellAlpha = 0.15 + (sell / maxLvlVol) * 0.72;
          ctx.fillStyle = rgba(SELL_CLR_BASE, sellAlpha);
          ctx.fillRect(cx - sellW, y, sellW, rowH);
        }

        // Buy bar (right of center, green)
        if (buyW > 0.5) {
          const buyAlpha = 0.15 + (buy / maxLvlVol) * 0.72;
          ctx.fillStyle = rgba(BUY_CLR_BASE, buyAlpha);
          ctx.fillRect(cx, y, buyW, rowH);
        }

        // Delta text (if row is tall enough)
        if (rowH >= 8 && (buy + sell) > 0) {
          ctx.fillStyle = delta >= 0 ? DELTA_POS_CLR : DELTA_NEG_CLR;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `7px "JetBrains Mono", monospace`;
          const label = delta >= 0 ? `+${fmtV(delta)}` : fmtV(delta);
          ctx.fillText(label, cx, y + rowH / 2);
        }
      }

      // ── OHLC bar ─────────────────────────────────────────────────────────
      if (candle.kline) {
        const { o, h, l, c } = candle.kline;
        const isGreen  = c >= o;
        const barColor = isGreen ? 'rgba(34,211,160,0.65)' : 'rgba(248,113,113,0.65)';
        const wickClr  = isGreen ? 'rgba(34,211,160,0.35)' : 'rgba(248,113,113,0.35)';
        const yO = py(o, pMin, pRange, chartH);
        const yC = py(c, pMin, pRange, chartH);
        const yH = py(h, pMin, pRange, chartH);
        const yL = py(l, pMin, pRange, chartH);
        const bodyTop = Math.min(yO, yC), bodyH = Math.max(Math.abs(yO - yC), 1);

        // Wick
        ctx.strokeStyle = wickClr; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, yH); ctx.lineTo(cx, yL);
        ctx.stroke();

        // Body
        ctx.fillStyle = barColor;
        ctx.fillRect(cx - BODY_W / 2, bodyTop, BODY_W, bodyH);
      }

      // ── Candle total delta at bottom ──────────────────────────────────────
      const { totalDelta } = candle;
      ctx.fillStyle    = totalDelta >= 0 ? DELTA_POS_CLR : DELTA_NEG_CLR;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      ctx.font         = '8px "JetBrains Mono", monospace';
      const dlabel = (totalDelta >= 0 ? '+' : '') + fmtV(totalDelta);
      ctx.fillText(dlabel, cx, chartH + 3);
    });

    // ── Vertical column dividers ─────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let ci = 0; ci < visible.length; ci++) {
      const x = ci * colStride;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, chartH); ctx.stroke();
    }

    // ── Price axis ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#0b0e17';
    ctx.fillRect(chartW, 0, PRICE_AXIS_W, H);
    ctx.strokeStyle = '#0f1520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(chartW, 0); ctx.lineTo(chartW, chartH); ctx.stroke();

    ctx.fillStyle = NEUTRAL_CLR;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '9px "JetBrains Mono", monospace';
    for (let p = gridStart; p <= pMax; p += gridStep) {
      const y = py(p, pMin, pRange, chartH);
      if (y < 6 || y > chartH - 6) continue;
      // Tick
      ctx.strokeStyle = '#1a2535'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(chartW, y); ctx.lineTo(chartW + 4, y); ctx.stroke();
      ctx.fillStyle = NEUTRAL_CLR;
      ctx.fillText(fmtP(p, symbol), W - 4, y);
    }

    // Current price pill (last candle last close)
    const lastCandle = visible[visible.length - 1];
    const livePrice  = lastCandle?.kline?.c;
    if (livePrice != null) {
      const y = py(livePrice, pMin, pRange, chartH);
      if (y >= 0 && y <= chartH) {
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath(); ctx.roundRect(chartW + 2, y - 8, PRICE_AXIS_W - 4, 16, 2); ctx.fill();
        ctx.fillStyle = '#93c5fd'; ctx.font = '9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(fmtP(livePrice, symbol), W - 4, y);
      }
    }

    // ── Time axis ─────────────────────────────────────────────────────────────
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, chartH, chartW, TIME_AXIS_H);
    ctx.strokeStyle = '#0f1520'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, chartH); ctx.lineTo(chartW, chartH); ctx.stroke();

    ctx.fillStyle = '#1e2d40';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '8.5px "JetBrains Mono", monospace';
    visible.forEach((candle, ci) => {
      const cx = ci * colStride + CANDLE_W / 2;
      const time = new Date(candle.ts).toTimeString().slice(0, 5);
      ctx.fillText(time, cx, chartH + TIME_AXIS_H / 2);
    });

    // ── Legend ────────────────────────────────────────────────────────────────
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = PANEL_LABEL; ctx.fillStyle = '#1a2535';
    ctx.fillText('FOOTPRINT  ·  1M  ·  VOL PER PRICE LEVEL', 8, 8);

    // Legend: buy/sell
    ctx.fillStyle = rgba(BUY_CLR_BASE, 0.7);
    ctx.fillRect(8, chartH - 24, 8, 8);
    ctx.fillStyle = '#1e2d40'; ctx.textBaseline = 'middle';
    ctx.fillText('BUY', 20, chartH - 20);
    ctx.fillStyle = rgba(SELL_CLR_BASE, 0.7);
    ctx.fillRect(46, chartH - 24, 8, 8);
    ctx.fillStyle = '#1e2d40';
    ctx.fillText('SELL', 58, chartH - 20);

  }, [symbol]);

  // rAF loop
  useEffect(() => {
    let alive = true;
    const loop = () => { if (!alive) return; render(); animRef.current = requestAnimationFrame(loop); };
    animRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(animRef.current); };
  }, [render]);

  // ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ro = new ResizeObserver(entries => {
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const py = (price, pMin, pRange, H) => H - ((price - pMin) / pRange) * H;

function fmtV(v) {
  const n = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (n >= 1000) return sign + (n / 1000).toFixed(1) + 'K';
  if (n >= 10)   return sign + n.toFixed(1);
  return sign + n.toFixed(3);
}

function fmtP(p, sym) {
  const d = sym?.includes('XRP') ? 4 : sym?.includes('SOL') ? 1 : sym?.includes('BNB') ? 2 : sym?.includes('ETH') ? 0 : 0;
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
