import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage.js';

const TAKER_FEE = 0.0004; // 0.04% taker fee
const MAINT_MARGIN = 0.004; // 0.4% maintenance margin (typical for BTC/ETH)

export function usePortfolio() {
  const [portfolio, setPortfolio] = useLocalStorage('flux_portfolio', {
    balance: 100000,
    positions: {}, // { [symbol]: { side: 'long'|'short', sizeCoin, sizeUsd, entryPrice, leverage } }
    history: []
  });

  // Calculate real-time stats for the UI
  const getPositionsWithPnl = useCallback((markPrices) => {
    return Object.entries(portfolio.positions).map(([symbol, pos]) => {
      const markPrice = markPrices[symbol] || pos.entryPrice;
      const isLong = pos.side === 'long';
      
      const priceDiff = isLong ? (markPrice - pos.entryPrice) : (pos.entryPrice - markPrice);
      const uPnl = pos.sizeCoin * priceDiff;
      const initialMargin = pos.sizeUsd / pos.leverage;
      const marginRatio = ((initialMargin + uPnl) / initialMargin) * 100;
      
      // Liq price approx (entry - margin_per_coin + maint_margin)
      const marginPerCoin = initialMargin / pos.sizeCoin;
      const liqPrice = isLong 
        ? pos.entryPrice - marginPerCoin * (1 - MAINT_MARGIN * pos.leverage)
        : pos.entryPrice + marginPerCoin * (1 - MAINT_MARGIN * pos.leverage);

      return {
        symbol,
        ...pos,
        markPrice,
        uPnl,
        initialMargin,
        marginRatio,
        liqPrice: Math.max(0, liqPrice)
      };
    });
  }, [portfolio.positions]);

  const placeMarketOrder = useCallback((symbol, side, sizeUsd, leverage, bids, asks) => {
    setPortfolio(prev => {
      const isBuy = side === 'long';
      let remainingUsd = sizeUsd;
      let totalCoin = 0;
      let totalCostUsd = 0;
      
      const ladder = isBuy ? asks : bids; // Market Buy eats Asks, Market Sell eats Bids

      for (const level of ladder) {
        if (remainingUsd <= 0) break;
        const price = level.p;
        const levelUsd = price * level.q;
        
        const fillUsd = Math.min(remainingUsd, levelUsd);
        const fillCoin = fillUsd / price;
        
        totalCoin += fillCoin;
        totalCostUsd += fillUsd;
        remainingUsd -= fillUsd;
      }

      const actualSizeUsd = totalCostUsd;
      if (actualSizeUsd === 0) return prev; // No liquidity

      const avgFillPrice = actualSizeUsd / totalCoin;
      const feeUsd = actualSizeUsd * TAKER_FEE;
      
      const existingPos = prev.positions[symbol];
      let newPositions = { ...prev.positions };
      let newBalance = prev.balance - feeUsd;

      let realizedPnl = 0;

      if (!existingPos) {
        newPositions[symbol] = { side, sizeCoin: totalCoin, sizeUsd: actualSizeUsd, entryPrice: avgFillPrice, leverage };
      } else if (existingPos.side === side) {
        // Add to position
        const totalUsdAfter = existingPos.sizeUsd + actualSizeUsd;
        const totalCoinAfter = existingPos.sizeCoin + totalCoin;
        newPositions[symbol] = {
          ...existingPos,
          sizeCoin: totalCoinAfter,
          sizeUsd: totalUsdAfter,
          entryPrice: totalUsdAfter / totalCoinAfter,
          leverage,
        };
      } else {
        // Reduce or flip position
        if (actualSizeUsd < existingPos.sizeUsd) {
          const reductionRatio = actualSizeUsd / existingPos.sizeUsd;
          const closedCoin = existingPos.sizeCoin * reductionRatio;
          const priceDiff = existingPos.side === 'short' 
            ? (existingPos.entryPrice - avgFillPrice)
            : (avgFillPrice - existingPos.entryPrice);

          realizedPnl = closedCoin * priceDiff;
          newBalance += realizedPnl;

          newPositions[symbol] = {
            ...existingPos,
            sizeCoin: existingPos.sizeCoin - closedCoin,
            sizeUsd: existingPos.sizeUsd - actualSizeUsd,
          };
        } else {
          // Full close / flip
          const priceDiff = existingPos.side === 'short' 
            ? (existingPos.entryPrice - avgFillPrice)
            : (avgFillPrice - existingPos.entryPrice);
          
          realizedPnl = existingPos.sizeCoin * priceDiff;
          newBalance += realizedPnl;

          const remainingNewUsd = actualSizeUsd - existingPos.sizeUsd;
          if (remainingNewUsd > 0.0001) {
            const remainingNewCoin = totalCoin - existingPos.sizeCoin;
            newPositions[symbol] = { side, sizeCoin: remainingNewCoin, sizeUsd: remainingNewUsd, entryPrice: avgFillPrice, leverage };
          } else {
            delete newPositions[symbol];
          }
        }
      }

      return {
        ...prev,
        balance: newBalance,
        positions: newPositions,
        history: [{
          time: Date.now(), symbol, action: 'MARKET_' + (isBuy ? 'BUY' : 'SELL'),
          fillPrice: avgFillPrice, sizeUsd: actualSizeUsd, fee: feeUsd, realizedPnl
        }, ...prev.history].slice(0, 50)
      };
    });
  }, [setPortfolio]);

  const closePosition = useCallback((symbol, currentPrice) => {
    setPortfolio(prev => {
      const pos = prev.positions[symbol];
      if (!pos) return prev;

      const isLong = pos.side === 'long';
      const priceDiff = isLong ? (currentPrice - pos.entryPrice) : (pos.entryPrice - currentPrice);
      const realizedPnl = pos.sizeCoin * priceDiff;
      const feeUsd = pos.sizeUsd * TAKER_FEE;
      
      const newBalance = prev.balance + realizedPnl - feeUsd;
      const newPositions = { ...prev.positions };
      delete newPositions[symbol];

      return {
        ...prev, balance: newBalance, positions: newPositions,
        history: [{
          time: Date.now(), symbol, action: 'MARKET_CLOSE',
          fillPrice: currentPrice, sizeUsd: pos.sizeUsd, fee: feeUsd, realizedPnl
        }, ...prev.history].slice(0, 50)
      };
    });
  }, [setPortfolio]);

  return { portfolio, getPositionsWithPnl, placeMarketOrder, closePosition };
}

