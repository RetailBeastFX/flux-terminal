import { useEffect, useRef, useState, useCallback } from 'react';
import { BUCKET_SIZES, MAX_LEVELS } from '../utils.js';

// ── Exchange config ────────────────────────────────────────────────────────────
const BYBIT_WS  = 'wss://stream.bybit.com/v5/public/spot';
const OKX_WS    = 'wss://ws.okx.com:8443/ws/v5/public';

const BYBIT_SYMBOLS = {
  BTCUSDT: 'BTCUSDT', ETHUSDT: 'ETHUSDT',
  SOLUSDT: 'SOLUSDT', BNBUSDT: 'BNBUSDT', XRPUSDT: 'XRPUSDT',
};
const OKX_SYMBOLS = {
  BTCUSDT: 'BTC-USDT', ETHUSDT: 'ETH-USDT',
  SOLUSDT: 'SOL-USDT', BNBUSDT: 'BNB-USDT', XRPUSDT: 'XRP-USDT',
};

// Exchange color tokens (used by OrderBook.jsx)
export const EXCHANGE_COLORS = {
  binance: '#3b82f6',  // blue
  bybit:   '#f97316',  // orange
  okx:     '#a855f7',  // purple
};

// ── Book manager — maintains a live Map<price, qty> from WS deltas ─────────────
function createBookManager() {
  const bids = new Map();
  const asks = new Map();
  return {
    snapshot(b, a) {
      bids.clear(); asks.clear();
      for (const [p, q] of b) { const qty = +q; if (qty > 0) bids.set(+p, qty); }
      for (const [p, q] of a) { const qty = +q; if (qty > 0) asks.set(+p, qty); }
    },
    delta(b, a) {
      for (const [p, q] of b) { const qty = +q; qty === 0 ? bids.delete(+p) : bids.set(+p, qty); }
      for (const [p, q] of a) { const qty = +q; qty === 0 ? asks.delete(+p) : asks.set(+p, qty); }
    },
    topBids(n = 50) { return [...bids.entries()].sort((a, b) => b[0] - a[0]).slice(0, n); },
    topAsks(n = 50) { return [...asks.entries()].sort((a, b) => a[0] - b[0]).slice(0, n); },
    clear()  { bids.clear(); asks.clear(); },
  };
}

// ── Merge all three books into unified bids/asks with per-exchange breakdown ────
function mergeBooks(binanceBids, binanceAsks, bybitMgr, okxMgr, bucketSize, maxLevels) {
  const bMap = new Map();
  const aMap = new Map();

  function bucket(p) {
    return Math.round(Math.floor(p / bucketSize) * bucketSize * 1e5) / 1e5;
  }
  function add(map, p, q, exchange) {
    const b = bucket(p);
    if (!map.has(b)) map.set(b, { total: 0, sources: {} });
    const lv = map.get(b);
    lv.total += q;
    lv.sources[exchange] = (lv.sources[exchange] || 0) + q;
  }

  // Binance (already bucketed)
  for (const { p, q } of binanceBids) add(bMap, p, q, 'binance');
  for (const { p, q } of binanceAsks) add(aMap, p, q, 'binance');

  // Bybit raw levels → same bucket
  for (const [p, q] of bybitMgr.topBids(60)) add(bMap, p, q, 'bybit');
  for (const [p, q] of bybitMgr.topAsks(60)) add(aMap, p, q, 'bybit');

  // OKX raw levels
  for (const [p, q] of okxMgr.topBids(60)) add(bMap, p, q, 'okx');
  for (const [p, q] of okxMgr.topAsks(60)) add(aMap, p, q, 'okx');

  const maxB = Math.max(...[...bMap.values()].map(v => v.total), 0.001);
  const maxA = Math.max(...[...aMap.values()].map(v => v.total), 0.001);

  const bids = [...bMap.entries()]
    .sort((a, b) => b[0] - a[0]).slice(0, maxLevels)
    .map(([p, { total, sources }]) => ({ p, q: total, pct: total / maxB, sources }));
  const asks = [...aMap.entries()]
    .sort((a, b) => a[0] - b[0]).slice(0, maxLevels)
    .map(([p, { total, sources }]) => ({ p, q: total, pct: total / maxA, sources }));

  return { bids, asks };
}

// ── Main hook ──────────────────────────────────────────────────────────────────
/**
 * Maintains Bybit + OKX WebSocket order books.
 * Call mergeWith(binanceBids, binanceAsks) to get unified book.
 * Returns { mergeWith, exchangeStatus }
 */
export function useMultiExchangeBook(symbol, enabled) {
  const bybitMgr = useRef(createBookManager());
  const okxMgr   = useRef(createBookManager());
  const [exchangeStatus, setExchangeStatus] = useState({
    bybit: 'off', okx: 'off',
  });
  const statusRef = useRef({ bybit: 'off', okx: 'off' });

  function setStatus(exchange, val) {
    statusRef.current = { ...statusRef.current, [exchange]: val };
    setExchangeStatus({ ...statusRef.current });
  }

  // ── Bybit WebSocket ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      bybitMgr.current.clear();
      setStatus('bybit', 'off');
      return;
    }

    const bySym = BYBIT_SYMBOLS[symbol];
    if (!bySym) return;

    let ws, dead = false, pingTimer, reconnTimer;

    function connect() {
      setStatus('bybit', 'connecting');
      ws = new WebSocket(BYBIT_WS);

      ws.onopen = () => {
        ws.send(JSON.stringify({ op: 'subscribe', args: [`orderbook.50.${bySym}`] }));
        // Bybit requires heartbeat pong
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' }));
        }, 20_000);
        setStatus('bybit', 'live');
      };

      ws.onclose = () => {
        if (dead) return;
        clearInterval(pingTimer);
        setStatus('bybit', 'reconnecting');
        reconnTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => setStatus('bybit', 'error');

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          // Pong response
          if (msg.op === 'pong' || msg.ret_msg === 'pong') return;
          // Order book update
          if (msg.topic?.startsWith('orderbook') && msg.data) {
            const { b = [], a = [] } = msg.data;
            if (msg.type === 'snapshot') bybitMgr.current.snapshot(b, a);
            else                         bybitMgr.current.delta(b, a);
          }
        } catch { /* ignore parse errors */ }
      };
    }

    connect();
    return () => {
      dead = true; clearInterval(pingTimer); clearTimeout(reconnTimer);
      ws?.close(); bybitMgr.current.clear();
      setStatus('bybit', 'off');
    };
  }, [symbol, enabled]);

  // ── OKX WebSocket ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      okxMgr.current.clear();
      setStatus('okx', 'off');
      return;
    }

    const okxSym = OKX_SYMBOLS[symbol];
    if (!okxSym) return;

    let ws, dead = false, pingTimer, reconnTimer;

    function connect() {
      setStatus('okx', 'connecting');
      ws = new WebSocket(OKX_WS);

      ws.onopen = () => {
        // books5 = top 5 levels, always snapshot — simple & no delta management needed
        ws.send(JSON.stringify({
          op: 'subscribe',
          args: [{ channel: 'books5', instId: okxSym }],
        }));
        // OKX heartbeat
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, 25_000);
        setStatus('okx', 'live');
      };

      ws.onclose = () => {
        if (dead) return;
        clearInterval(pingTimer);
        setStatus('okx', 'reconnecting');
        reconnTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => setStatus('okx', 'error');

      ws.onmessage = (evt) => {
        try {
          if (evt.data === 'pong') return;
          const msg = JSON.parse(evt.data);
          if (msg.data?.[0]) {
            const { bids = [], asks = [] } = msg.data[0];
            // books5 always sends full snapshot
            okxMgr.current.snapshot(bids, asks);
          }
        } catch { /* ignore */ }
      };
    }

    connect();
    return () => {
      dead = true; clearInterval(pingTimer); clearTimeout(reconnTimer);
      ws?.close(); okxMgr.current.clear();
      setStatus('okx', 'off');
    };
  }, [symbol, enabled]);

  // mergeWith — called by consumer on each Binance update
  const mergeWith = useCallback((binanceBids, binanceAsks) => {
    const bs = BUCKET_SIZES[symbol] || 1;
    return mergeBooks(binanceBids, binanceAsks, bybitMgr.current, okxMgr.current, bs, MAX_LEVELS);
  }, [symbol]);

  return { mergeWith, exchangeStatus };
}
