import { useEffect, useRef, useState } from 'react';
import { BUCKET_SIZES } from '../utils.js';

const MAX_CANDLES = 60; // keep 60 minutes of footprint data

/**
 * Accumulates aggTrade data into per-candle, per-price-bucket volumes.
 * Returns an array of footprint candles, newest last.
 *
 * Each footprint candle = {
 *   ts:         candle open timestamp (ms floored to 1m)
 *   levels:     Map<priceBucket, { buy, sell, delta }>
 *   totalBuy:   total buy vol in candle
 *   totalSell:  total sell vol in candle
 *   totalDelta: totalBuy - totalSell
 *   kline:      matching kline object (o/h/l/c) or null
 * }
 */
export function useFootprint(trades, klines, symbol) {
  // Persistent accumulator — never reset (trades are additive)
  const fpMapRef      = useRef(new Map()); // Map<candleTs, Map<bucket, {buy,sell}>>
  const lastTradeRef  = useRef(null);
  const [footprint, setFootprint] = useState([]);

  // Reset on symbol change
  const prevSymbol = useRef(symbol);
  useEffect(() => {
    if (prevSymbol.current !== symbol) {
      fpMapRef.current = new Map();
      lastTradeRef.current = null;
      setFootprint([]);
      prevSymbol.current = symbol;
    }
  }, [symbol]);

  // Process incoming trades
  useEffect(() => {
    if (!trades.length) return;

    const bs  = BUCKET_SIZES[symbol] || 1;
    const fp  = fpMapRef.current;
    let dirty = false;

    // Trades are newest-first; process until we hit the last seen id
    for (const t of trades) {
      if (t.id === lastTradeRef.current) break;

      const candleTs = Math.floor(t.time / 60_000) * 60_000;
      const bucket   = Math.round(Math.floor(t.price / bs) * bs * 1e5) / 1e5;

      if (!fp.has(candleTs)) fp.set(candleTs, new Map());
      const cmap = fp.get(candleTs);

      if (!cmap.has(bucket)) cmap.set(bucket, { buy: 0, sell: 0 });
      const lv = cmap.get(bucket);
      if (t.isBuy) lv.buy  += t.qty;
      else         lv.sell += t.qty;

      dirty = true;
    }

    // Mark last seen trade
    if (trades[0]) lastTradeRef.current = trades[0].id;

    if (!dirty) return;

    // Prune to MAX_CANDLES
    const keys = [...fp.keys()].sort((a, b) => a - b);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CANDLES))) fp.delete(k);

    // Build output array sorted by candleTs
    const klineMap = new Map(klines.map(k => [k.t, k]));
    const out = [...fp.keys()].sort((a, b) => a - b).map(ts => {
      const cmap  = fp.get(ts);
      let totalBuy = 0, totalSell = 0;
      const levels = new Map();
      for (const [price, { buy, sell }] of cmap) {
        const delta = buy - sell;
        levels.set(price, { buy, sell, delta });
        totalBuy  += buy;
        totalSell += sell;
      }
      return {
        ts,
        levels,
        totalBuy,
        totalSell,
        totalDelta: totalBuy - totalSell,
        kline: klineMap.get(ts) || null,
      };
    });

    setFootprint(out);
  }, [trades, klines, symbol]);

  return footprint;
}
