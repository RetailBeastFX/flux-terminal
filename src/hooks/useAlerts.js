import { useState, useCallback, useEffect, useRef } from 'react';

let notifPermission = 'default';

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { notifPermission = 'granted'; return; }
  if (Notification.permission !== 'denied') {
    const result = await Notification.requestPermission();
    notifPermission = result;
  }
}

function fireNotification(title, body) {
  requestNotifPermission().then(() => {
    if (notifPermission === 'granted') {
      try { new Notification(title, { body, icon: '/favicon.ico', silent: false }); } catch { /* */ }
    }
  });
}

function fmtUsd(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Thresholds for large-trade alerts (USD)
const LARGE_TRADE_THRESHOLD = {
  BTCUSDT:  500_000,
  ETHUSDT:  200_000,
  SOLUSDT:   50_000,
  BNBUSDT:   50_000,
  XRPUSDT:   50_000,
  DOGEUSDT:  20_000,
  AVAXUSDT:  20_000,
  ADAUSDT:   20_000,
  LINKUSDT:  20_000,
  DOTUSDT:   20_000,
};

const LARGE_LIQ_THRESHOLD = {
  BTCUSDT:  200_000,
  ETHUSDT:  100_000,
  SOLUSDT:   20_000,
  BNBUSDT:   20_000,
  XRPUSDT:   20_000,
  DOGEUSDT:  10_000,
  AVAXUSDT:  10_000,
  ADAUSDT:   10_000,
  LINKUSDT:  10_000,
  DOTUSDT:   10_000,
};

/**
 * Manages price alerts, large-trade alerts, and large-liquidation alerts.
 * Returns { alerts, alertPrices, addAlert, removeAlert, checkAlerts,
 *           triggerLargeTradeAlert, triggerLargeLiqAlert, toasts }
 */
export function useAlerts(symbol) {
  const [alerts, setAlerts]   = useState([]);
  const [toasts, setToasts]   = useState([]);
  const alertsRef             = useRef([]);
  const prevSymbol            = useRef(symbol);
  const lastLiqAlertRef       = useRef({});   // tracks last alert time per liq side

  // Clear price alerts when symbol changes
  useEffect(() => {
    if (prevSymbol.current !== symbol) {
      alertsRef.current = [];
      setAlerts([]);
      prevSymbol.current = symbol;
      lastLiqAlertRef.current = {};
    }
  }, [symbol]);

  // ── Price alerts ────────────────────────────────────────────────────────────
  const addAlert = useCallback((price, label = '') => {
    const al = {
      id:        `al-${Date.now()}-${Math.random()}`,
      price:     parseFloat(price),
      label:     label || `${price}`,
      symbol,
      direction: null,
      triggered: false,
      created:   Date.now(),
    };
    alertsRef.current = [...alertsRef.current, al];
    setAlerts([...alertsRef.current]);
    requestNotifPermission();
    return al.id;
  }, [symbol]);

  const removeAlert = useCallback((id) => {
    alertsRef.current = alertsRef.current.filter(a => a.id !== id);
    setAlerts([...alertsRef.current]);
  }, []);

  const checkAlerts = useCallback((currentPrice) => {
    if (!currentPrice || !alertsRef.current.length) return;
    let changed = false;
    const newToasts = [];

    alertsRef.current = alertsRef.current.map(al => {
      if (al.triggered) return al;
      if (al.direction === null) {
        return { ...al, direction: currentPrice >= al.price ? 'above' : 'below' };
      }
      const crossed = (al.direction === 'above' && currentPrice < al.price)
                   || (al.direction === 'below' && currentPrice >= al.price);
      if (crossed) {
        changed = true;
        const msg = `${symbol} crossed ${al.price.toLocaleString()}`;
        fireNotification(`⚑ FLUX Alert — ${symbol}`, msg);
        newToasts.push({
          id:      `toast-${Date.now()}-${Math.random()}`,
          type:    'price',
          icon:    '⚑',
          message: msg,
          symbol,
          ts:      Date.now(),
        });
        return { ...al, triggered: true };
      }
      return al;
    });

    if (changed) {
      setAlerts([...alertsRef.current]);
      setToasts(prev => [...newToasts, ...prev].slice(0, 6));
    }
  }, [symbol]);

  // ── Large trade alert ───────────────────────────────────────────────────────
  const triggerLargeTradeAlert = useCallback((trade) => {
    const threshold = LARGE_TRADE_THRESHOLD[symbol] || 50_000;
    const usd = trade.p * trade.q;
    if (usd < threshold) return;
    const side = trade.buy ? 'BUY 🟢' : 'SELL 🔴';
    const msg  = `${symbol} ${side} ${fmtUsd(usd)} @ ${trade.p.toLocaleString()}`;
    fireNotification(`⚡ Large Trade — ${symbol}`, msg);
    setToasts(prev => [{
      id:      `toast-lt-${Date.now()}`,
      type:    trade.buy ? 'large_buy' : 'large_sell',
      icon:    trade.buy ? '⚡' : '💥',
      message: msg,
      symbol,
      ts:      Date.now(),
    }, ...prev].slice(0, 6));
  }, [symbol]);

  // ── Large liquidation alert ─────────────────────────────────────────────────
  const triggerLargeLiqAlert = useCallback((liq) => {
    const threshold = LARGE_LIQ_THRESHOLD[symbol] || 10_000;
    if (liq.usdValue < threshold) return;

    const key  = liq.isLong ? 'long' : 'short';
    const now  = Date.now();
    const last = lastLiqAlertRef.current[key] || 0;
    if (now - last < 5000) return;  // dedupe — max 1 alert per 5s per side
    lastLiqAlertRef.current[key] = now;

    const side = liq.isLong ? 'LONG LIQ ⬇' : 'SHORT LIQ ⬆';
    const msg  = `${symbol} ${side} ${fmtUsd(liq.usdValue)} @ ${liq.price.toLocaleString()}`;
    fireNotification(`💧 Large Liquidation — ${symbol}`, msg);
    setToasts(prev => [{
      id:      `toast-liq-${Date.now()}`,
      type:    liq.isLong ? 'liq_long' : 'liq_short',
      icon:    liq.isLong ? '💧' : '🚀',
      message: msg,
      symbol,
      ts:      Date.now(),
    }, ...prev].slice(0, 6));
  }, [symbol]);

  // Auto-dismiss toasts after 8 seconds
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.ts < 8000));
    }, 1000);
    return () => clearTimeout(t);
  }, [toasts]);

  const alertPrices = alerts.filter(a => !a.triggered).map(a => ({ price: a.price }));

  return {
    alerts, alertPrices,
    addAlert, removeAlert, checkAlerts,
    triggerLargeTradeAlert, triggerLargeLiqAlert,
    toasts,
  };
}
