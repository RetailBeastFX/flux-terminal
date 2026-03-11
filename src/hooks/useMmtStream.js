import { useEffect, useRef, useState } from 'react';
import { BUCKET_SIZES, MAX_LEVELS, MAX_TRADES, MAX_CVD_HIST, aggregate } from '../utils.js';

export function useMmtStream(symbol, timeframe = '1m') {
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

  // Replace Binance with MMT mapping
  // We need the API Key from localStorage
  const apiKey = localStorage.getItem('mmt_api_key');

  // Fetch initial klines from MMT REST API
  useEffect(() => {
    if (!apiKey) return;
    
    // Normalize format to MMT base/quote (e.g. BTCUSDT -> btc/usdt)
    const mmtSymbol = symbol.replace('USDT', '/usdt').toLowerCase();
    
    // Calculate timestamp bounds for historical data
    const tfToSeconds = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600
    };
    
    const seconds = tfToSeconds[timeframe] || 60;
    const to = Math.floor(Date.now() / 1000);
    const from = to - (seconds * 120); // Get ~120 bars

    fetch(`/mmt-api/api/v1/candles?exchange=binancef&symbol=${mmtSymbol}&tf=${timeframe}&from=${from}&to=${to}`, {
      headers: { 'X-API-Key': apiKey }
    })
      .then(r => r.json())
      .then(res => {
        if (!res?.data) return;
        
        const tObj = res.data.t || {};
        const oObj = res.data.o || {};
        const hObj = res.data.h || {};
        const lObj = res.data.l || {};
        const cObj = res.data.c || {};
        const vObj = res.data.v || {};
        
        const length = Object.keys(tObj).length;
        const formattedKlines = [];
        
        for (let i = 0; i < length; i++) {
          formattedKlines.push({
            t: tObj[i] * 1000,
            o: +oObj[i],
            h: +hObj[i],
            l: +lObj[i],
            c: +cObj[i],
            v: +vObj[i],
            time: new Date(tObj[i] * 1000).toTimeString().slice(0, 5)
          });
        }
        
        setKlines(formattedKlines);
      })
      .catch(err => console.warn('MMT klines fetch error', err));
  }, [symbol, timeframe, apiKey]);

  // WebSocket Connection
  useEffect(() => {
    if (!apiKey) {
      setStatus('offline');
      return;
    }

    wsRef.current?.close();
    cvdRef.current = 0;
    tradesRef.current = [];
    cvdHistRef.current = [];
    setCvd(0); setCvdHist([]); setBids([]); setAsks([]);
    setTrades([]); setTicker({}); setStatus('connecting');

    const mmtSymbol = symbol.replace('USDT', '/usdt').toLowerCase();
    
    // Connect via Vite proxy
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/mmt-ws/api/v1/ws?api_key=${apiKey}`;

    let ws;
    let dead = false;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connecting'); // wait for "connected" message
      };

      ws.onclose = () => {
        if (dead) return;
        setStatus('reconnecting');
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (e) => {
        console.warn('MMT WS error', e);
        setStatus('error');
      };

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);

        // Wait for welcome message before subscribing
        if (msg.type === "connected") {
          setStatus('live');
          ws.send(JSON.stringify({
            action: "subscribe",
            streams: [
              { id: "orderbook", exchanges: ["binancef"], symbols: [mmtSymbol], limit: 20 },
              { id: "trades", exchanges: ["binancef"], symbols: [mmtSymbol] },
              { id: "candles", exchanges: ["binancef"], symbols: [mmtSymbol], tf: timeframe },
              { id: "stats", exchanges: ["binancef"], symbols: [mmtSymbol] }
            ]
          }));
          return;
        }

        if (!msg.data) return;

        // Ensure we only process data for our selected symbol (ignoring case)
        if (msg.data.symbol && msg.data.symbol.toLowerCase() !== mmtSymbol) return;

        // Handle Orderbook Updates
        if (msg.stream === "orderbook" || msg.stream === "orderbook_snapshot") {
          const d = msg.data;
          const bs = BUCKET_SIZES[symbol] || 1;
          
          if (d.b && d.a) {
            // MMT returns obj structure or arrays? The docs didn't show WS payload specifically,
            // but assuming standard {"b": [[price, size]], "a": [[price, size]]} based on REST
            let parsedBids = Array.isArray(d.b) ? d.b : Object.values(d.b || {});
            let parsedAsks = Array.isArray(d.a) ? d.a : Object.values(d.a || {});

            const rawBids = aggregate(parsedBids, bs).sort((a, b) => b[0] - a[0]).slice(0, MAX_LEVELS);
            const rawAsks = aggregate(parsedAsks, bs).sort((a, b) => a[0] - b[0]).slice(0, MAX_LEVELS);
            
            const maxB = Math.max(...rawBids.map(x => x[1]), 0.001);
            const maxA = Math.max(...rawAsks.map(x => x[1]), 0.001);
            
            setBids(rawBids.map(([p, q]) => ({ p, q, pct: q / maxB })));
            setAsks(rawAsks.map(([p, q]) => ({ p, q, pct: q / maxA })));
          }
        }

        // Handle Live Trades
        if (msg.stream === "trades") {
          const d = msg.data;
          // Extract isBuy based on standard convention (maker vs taker side)
          const isBuy = d.s === "buy" || d.m === false; 
          const tr = { id: d.i || Date.now(), price: +d.p, qty: +d.q, isBuy, time: d.t * 1000 };
          
          cvdRef.current += isBuy ? tr.qty : -tr.qty;
          tradesRef.current = [tr, ...tradesRef.current].slice(0, MAX_TRADES);
          cvdHistRef.current = [...cvdHistRef.current, { cvd: cvdRef.current }].slice(-MAX_CVD_HIST);
          
          setCvd(cvdRef.current);
          setTrades([...tradesRef.current]);
          setCvdHist([...cvdHistRef.current]);
          
          // Trigger a fake tick update to keep ticker active based on Last Traded Price
          setTicker(prev => ({
            ...prev,
            price: tr.price,
            change: prev?.change || 0,
            high: prev?.high || tr.price,
            low: prev?.low || tr.price,
            vol: (prev?.vol || 0) + tr.qty
          }));
        }

        // Handle Candle/Kline Updates
        if (msg.stream === "candles") {
          const d = msg.data;
          const bar = {
            t:    d.t * 1000,
            o:    +d.o,
            h:    +d.h,
            l:    +d.l,
            c:    +d.c,
            v:    +d.v,
            time: new Date(d.t * 1000).toTimeString().slice(0, 5),
          };
          setKlines(prev => {
            if (!prev.length) return [bar];
            const last = prev[prev.length - 1];
            if (last.t === bar.t) {
              return [...prev.slice(0, -1), bar];
            }
            return [...prev, bar].slice(-120);
          });
        }
        
        // Handle comprehensive stats (24hr ticker data equivalent)
        if (msg.stream === "stats") {
          const d = msg.data;
          setTicker(prev => ({
            price: prev?.price || +d.c,
            change: +d.pc || 0,
            high: +d.h || prev?.high,
            low: +d.l || prev?.low,
            vol: +d.v || prev?.vol,
            qvol: +d.q || prev?.qvol,
            funding: +d.fr
          }));
        }
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [symbol, timeframe, apiKey]);

  const spread = bids[0] && asks[0] ? asks[0].p - bids[0].p : null;
  return { bids, asks, trades, ticker, klines, cvd, cvdHist, spread, status };
}
