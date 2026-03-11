import { useMemo } from 'react';

export function useIndicators(klines) {
  return useMemo(() => {
    if (!klines || klines.length === 0) return klines;
    
    // EMA function helper
    const calcEma = (period, data, dataKey = 'c') => {
      const k = 2 / (period + 1);
      let ema = data[0][dataKey];
      return data.map((d, i) => {
        if (i === 0) return ema;
        ema = (d[dataKey] - ema) * k + ema;
        return ema;
      });
    };

    const ema8 = calcEma(8, klines);
    const ema21 = calcEma(21, klines);

    let sumPV = 0;
    let sumV = 0;
    let currentDay = -1;

    return klines.map((k, i) => {
      // UTC day reset for VWAP
      const day = new Date(k.t).getUTCDate();
      if (day !== currentDay) {
        sumPV = 0;
        sumV = 0;
        currentDay = day;
      }
      
      // Volume Weighted Average Price using typical price
      const typicalPrice = (k.h + k.l + k.c) / 3;
      sumPV += typicalPrice * k.v;
      sumV  += k.v;
      
      const vwap = sumV === 0 ? k.c : sumPV / sumV;

      return {
        ...k,
        ema8: ema8[i],
        ema21: ema21[i],
        vwap: vwap
      };
    });
  }, [klines]);
}
