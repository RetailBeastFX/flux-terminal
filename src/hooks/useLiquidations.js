import { useEffect, useRef, useState } from 'react';

// Binance Global Futures — forceOrder stream (no geo-restriction on WS)
const FUTURES_WS_BASE = 'wss://fstream.binance.com/ws';

// Symbol mapping: spot → futures (same for most, but important to be explicit)
const FUTURES_SYMBOL = {
  BTCUSDT: 'btcusdt',
  ETHUSDT: 'ethusdt',
  SOLUSDT: 'solusdt',
  BNBUSDT: 'bnbusdt',
  XRPUSDT: 'xrpusdt',
  DOGEUSDT: 'dogeusdt',
  AVAXUSDT: 'avaxusdt',
  ADAUSDT:  'adausdt',
  LINKUSDT: 'linkusdt',
  DOTUSDT:  'dotusdt',
};

const MAX_LIQS = 300; // rolling window

/**
 * Connects to Binance Futures forceOrder stream for the given symbol.
 * Returns { liqs } — array newest-first:
 * { id, time, price, qty, usdValue, isLong (true = long liq = SELL side) }
 */
export function useLiquidations(symbol) {
  const [liqs, setLiqs] = useState([]);
  const liqsRef         = useRef([]);
  const prevSymbol      = useRef(symbol);

  useEffect(() => {
    if (prevSymbol.current !== symbol) {
      liqsRef.current = [];
      setLiqs([]);
      prevSymbol.current = symbol;
    }
  }, [symbol]);

  useEffect(() => {
    const fsym = FUTURES_SYMBOL[symbol];
    if (!fsym) return;

    let ws, dead = false, reconnTimer;

    function connect() {
      ws = new WebSocket(`${FUTURES_WS_BASE}/${fsym}@forceOrder`);

      ws.onopen  = () => {};
      ws.onerror = () => {};
      ws.onclose = () => {
        if (dead) return;
        reconnTimer = setTimeout(connect, 3000);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          // forceOrder event structure
          const o = msg.o || msg;
          if (!o || !o.ap) return;

          const price    = parseFloat(o.ap);  // avg fill price
          const qty      = parseFloat(o.q);
          const usdValue = price * qty;
          const isLong   = o.S === 'SELL';   // SELL side = long liquidated

          const liq = {
            id:       `${msg.E || Date.now()}-${Math.random()}`,
            time:     o.T || msg.E || Date.now(),
            price,
            qty,
            usdValue,
            isLong,
          };

          liqsRef.current = [liq, ...liqsRef.current].slice(0, MAX_LIQS);
          setLiqs([...liqsRef.current]);
        } catch { /* ignore parse errors */ }
      };
    }

    connect();
    return () => {
      dead = true;
      clearTimeout(reconnTimer);
      ws?.close();
    };
  }, [symbol]);

  return { liqs };
}
