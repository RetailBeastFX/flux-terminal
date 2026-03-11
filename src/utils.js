// ─── Formatting helpers ───────────────────────────────────────────────────
export const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'AVAXUSDT', 'ADAUSDT', 'LINKUSDT', 'DOTUSDT',
];

export const BUCKET_SIZES = {
  BTCUSDT:  10,
  ETHUSDT:  1,
  SOLUSDT:  0.1,
  BNBUSDT:  0.5,
  XRPUSDT:  0.001,
  DOGEUSDT: 0.0001,
  AVAXUSDT: 0.1,
  ADAUSDT:  0.001,
  LINKUSDT: 0.05,
  DOTUSDT:  0.05,
};

export const SYMBOL_KEYS = {
  BTCUSDT:'B', ETHUSDT:'E', SOLUSDT:'S', BNBUSDT:'N', XRPUSDT:'X',
  DOGEUSDT:'D', AVAXUSDT:'V', ADAUSDT:'C', LINKUSDT:'L', DOTUSDT:'O',
};

export const DECIMAL_PLACES = {
  BTCUSDT:  1,
  ETHUSDT:  2,
  SOLUSDT:  2,
  BNBUSDT:  2,
  XRPUSDT:  4,
  DOGEUSDT: 5,
  AVAXUSDT: 2,
  ADAUSDT:  4,
  LINKUSDT: 3,
  DOTUSDT:  3,
};

export const MAX_LEVELS   = 14;
export const MAX_TRADES   = 500;   // enough for footprint accumulation
export const MAX_CVD_HIST = 300;

export function fmt(p, sym = 'BTCUSDT') {
  if (p == null || p === '') return '—';
  const d = DECIMAL_PLACES[sym] ?? 2;
  return parseFloat(p).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtQty(q) {
  const n = parseFloat(q);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(2) + 'K';
  if (n >= 100)       return n.toFixed(2);
  if (n >= 10)        return n.toFixed(3);
  return n.toFixed(4);
}

export function fmtTime(ts) {
  return new Date(ts).toTimeString().slice(0, 8);
}

export function fmtShortTime(ts) {
  return new Date(ts).toTimeString().slice(0, 5);
}

// Aggregate raw order book levels into price buckets
export function aggregate(levels, bucketSize) {
  const map = new Map();
  for (const [ps, qs] of levels) {
    const q = parseFloat(qs);
    if (q === 0) continue;
    const p = parseFloat(ps);
    const bucket = Math.round(Math.floor(p / bucketSize) * bucketSize * 100000) / 100000;
    map.set(bucket, (map.get(bucket) || 0) + q);
  }
  return Array.from(map.entries());
}

// Compute buy/sell ratio from recent trades
export function computeBuyPct(trades, count = 40) {
  const recent = trades.slice(0, count);
  const buyVol  = recent.filter(t => t.isBuy).reduce((s, t) => s + t.qty, 0);
  const totalVol = recent.reduce((s, t) => s + t.qty, 0);
  return totalVol > 0 ? (buyVol / totalVol) * 100 : 50;
}
