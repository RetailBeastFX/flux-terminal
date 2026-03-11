import { useEffect, useRef, useState } from 'react';
import {
  BUCKET_SIZES,
  MAX_LEVELS,
  MAX_TRADES,
  MAX_CVD_HIST,
  aggregate,
} from '../utils.js';

// ─── WebSocket multi-stream hook ────────────────────────────────────────────
// Uses Vite's local proxy (/binance-api, /binance-ws) to bypass CORS.
export function useBinanceStream(symbol, timeframe = '1m') {
  const [bids, setBids]       = useState([]);
  const [asks, setAsks]       = useState([]);
  const [trades, setTrades]   = useState([]);
  const [ticker, setTicker]   = useState(null);
  const [klines, setKlines]   = useState([]);
  const [cvdHist, setCvdHist] = useState([]);
  const [cvd, setCvd]         = useState(0);
  const [status, setStatus]   = useState('connecting');

  const wsRef      = useRef(null);
  const cvdRef     = useRef(0);
  const tradesRef  = useRef([]);
  const cvdHistRef = useRef([]);

  // ── Historical klines via proxy ───────────────────────────────────────────
  useEffect(() => {
    fetch(`/binance-api/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=120`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
          console.warn('klines response is not an array (region block?):', data);
          return;
        }
        setKlines(data.map(d => ({
          t:    d[0],
          o:    +d[1],
          h:    +d[2],
          l:    +d[3],
          c:    +d[4],
          v:    +d[5],
          time: new Date(d[0]).toTimeString().slice(0, 5),
        })));
      })
      .catch(err => console.warn('klines fetch error', err));
  }, [symbol, timeframe]);

  // ── WebSocket via proxy ───────────────────────────────────────────────────
  useEffect(() => {
    wsRef.current?.close();
    cvdRef.current = 0;
    tradesRef.current = [];
    cvdHistRef.current = [];
    setCvd(0); setCvdHist([]); setBids([]); setAsks([]);
    setTrades([]); setTicker(null); setStatus('connecting');

    // WebSockets don't enforce CORS — connect directly to Binance US
    const sym     = symbol.toLowerCase();
    const streams = `${sym}@depth20@100ms/${sym}@aggTrade/${sym}@miniTicker/${sym}@kline_${timeframe}`;
    const wsUrl   = `wss://stream.binance.us:9443/stream?streams=${streams}`;

    let ws;
    let dead = false;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen  = () => setStatus('live');
      ws.onclose = () => {
        if (dead) return;
        setStatus('reconnecting');
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = (e) => {
        console.warn('WS error', e);
        setStatus('error');
      };

      ws.onmessage = (evt) => {
        const { stream, data: d } = JSON.parse(evt.data);

        if (stream.includes('@depth')) {
          const bs = BUCKET_SIZES[symbol] || 1;
          const rawBids = aggregate(d.bids, bs).sort((a, b) => b[0] - a[0]).slice(0, MAX_LEVELS);
          const rawAsks = aggregate(d.asks, bs).sort((a, b) => a[0] - b[0]).slice(0, MAX_LEVELS);
          const maxB = Math.max(...rawBids.map(x => x[1]), 0.001);
          const maxA = Math.max(...rawAsks.map(x => x[1]), 0.001);
          setBids(rawBids.map(([p, q]) => ({ p, q, pct: q / maxB })));
          setAsks(rawAsks.map(([p, q]) => ({ p, q, pct: q / maxA })));
        }

        if (stream.includes('@aggTrade')) {
          const isBuy = !d.m;
          const tr = { id: d.a, price: +d.p, qty: +d.q, isBuy, time: d.T };
          cvdRef.current += isBuy ? tr.qty : -tr.qty;
          tradesRef.current = [tr, ...tradesRef.current].slice(0, MAX_TRADES);
          cvdHistRef.current = [...cvdHistRef.current, { cvd: cvdRef.current }].slice(-MAX_CVD_HIST);
          setCvd(cvdRef.current);
          setTrades([...tradesRef.current]);
          setCvdHist([...cvdHistRef.current]);
        }

        if (stream.includes('@miniTicker')) {
          setTicker({ price: +d.c, change: +d.P, high: +d.h, low: +d.l, vol: +d.v, qvol: +d.q });
        }

        if (stream.includes('@kline_')) {
          const k = d.k;
          const bar = {
            t:    k.t,
            o:    +k.o,
            h:    +k.h,
            l:    +k.l,
            c:    +k.c,
            v:    +k.v,
            time: new Date(k.t).toTimeString().slice(0, 5),
          };
          setKlines(prev => {
            if (!prev.length) return [bar];
            const last = prev[prev.length - 1];
            if (last.t === bar.t) {
              // update current bar
              return [...prev.slice(0, -1), bar];
            }
            // new bar
            return [...prev, bar].slice(-120);
          });
        }
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [symbol, timeframe]);

  const spread = bids[0] && asks[0] ? asks[0].p - bids[0].p : null;
  return { bids, asks, trades, ticker, klines, cvd, cvdHist, spread, status };
}
