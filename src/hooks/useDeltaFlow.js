import { useRef, useState, useEffect, useCallback } from 'react';

const INTERVAL_MS  = 10_000;  // 10-second buckets
const MAX_BUCKETS  = 60;      // keep 10 minutes of history

/**
 * Accumulates live trades into delta buckets:
 * delta = buyVolume - sellVolume (in USD)
 * Returns { buckets } — array of {
 *   ts, buyUsd, sellUsd, delta, totalTrades, bigBuy, bigSell
 * } oldest-first
 */
export function useDeltaFlow(trades) {
  const bucketsRef  = useRef([]);
  const currentRef  = useRef(null);
  const [buckets, setBuckets] = useState([]);

  const flush = useCallback(() => {
    if (!currentRef.current) return;
    bucketsRef.current = [...bucketsRef.current, currentRef.current].slice(-MAX_BUCKETS);
    currentRef.current = null;
    setBuckets([...bucketsRef.current]);
  }, []);

  // Flush completed intervals
  useEffect(() => {
    const id = setInterval(flush, INTERVAL_MS);
    return () => clearInterval(id);
  }, [flush]);

  // Accumulate incoming trades
  const prevTrades = useRef([]);
  useEffect(() => {
    if (!trades || trades.length === 0) return;

    // Find new trades since last render
    const prevLen = prevTrades.current.length;
    const newTrades = prevLen === 0
      ? trades
      : trades.filter(t => !prevTrades.current.includes(t));
    prevTrades.current = trades;

    if (newTrades.length === 0) return;

    const now = Date.now();
    const bucketTs = Math.floor(now / INTERVAL_MS) * INTERVAL_MS;

    // Ensure current bucket matches current interval
    if (!currentRef.current || currentRef.current.ts !== bucketTs) {
      if (currentRef.current) flush();
      currentRef.current = {
        ts: bucketTs,
        buyUsd:   0,
        sellUsd:  0,
        delta:    0,
        totalTrades: 0,
        bigBuy:   0,   // largest single buy in USD
        bigSell:  0,   // largest single sell in USD
      };
    }

    const cur = currentRef.current;
    for (const t of newTrades) {
      const usd = t.p * t.q;
      if (t.buy) {
        cur.buyUsd  += usd;
        if (usd > cur.bigBuy) cur.bigBuy = usd;
      } else {
        cur.sellUsd += usd;
        if (usd > cur.bigSell) cur.bigSell = usd;
      }
      cur.totalTrades++;
    }
    cur.delta = cur.buyUsd - cur.sellUsd;
  }, [trades, flush]);

  // Live bucket = historical + current partial
  const liveBuckets = currentRef.current
    ? [...bucketsRef.current, currentRef.current]
    : bucketsRef.current;

  return { buckets: liveBuckets.slice(-MAX_BUCKETS) };
}
