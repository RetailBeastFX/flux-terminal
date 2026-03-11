import { useEffect, useRef, useState } from 'react';

const MAX_FRAMES  = 600; // ~1 frame per depth update (100ms) = ~60s of history
const MAX_TRADES  = 2000;

/**
 * Accumulates order book depth frames and trade events for the heatmap.
 * Each frame = one snapshot of bids + asks + mid price.
 * Resets when symbol changes.
 */
export function useHeatmapData(bids, asks, trades, symbol) {
  const [frames, setFrames]     = useState([]);
  const [tradeLog, setTradeLog] = useState([]);

  const framesRef   = useRef([]);
  const tradeLogRef = useRef([]);
  const prevSymbol  = useRef(symbol);

  // Reset on symbol change
  useEffect(() => {
    if (prevSymbol.current !== symbol) {
      framesRef.current   = [];
      tradeLogRef.current = [];
      setFrames([]);
      setTradeLog([]);
      prevSymbol.current = symbol;
    }
  }, [symbol]);

  // Capture a new depth frame whenever bids/asks arrive
  useEffect(() => {
    if (!bids.length && !asks.length) return;

    const midPrice = bids[0] && asks[0]
      ? (bids[0].p + asks[0].p) / 2
      : null;

    const frame = {
      ts:       Date.now(),
      bids:     bids.map(({ p, q }) => ({ p, q })),
      asks:     asks.map(({ p, q }) => ({ p, q })),
      midPrice,
    };

    framesRef.current = [...framesRef.current, frame].slice(-MAX_FRAMES);
    setFrames([...framesRef.current]);
  }, [bids, asks]);

  // Log trades for overlay dots
  useEffect(() => {
    if (!trades.length) return;
    const newest = trades[0]; // most recent trade
    if (!newest) return;
    // Avoid duplicates
    const last = tradeLogRef.current[0];
    if (last && last.id === newest.id) return;

    tradeLogRef.current = [newest, ...tradeLogRef.current].slice(0, MAX_TRADES);
    setTradeLog([...tradeLogRef.current]);
  }, [trades]);

  return { frames, tradeLog };
}
