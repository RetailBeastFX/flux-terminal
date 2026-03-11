import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useBinanceStream }       from './hooks/useBinanceStream.js';
import { useHeatmapData }         from './hooks/useHeatmapData.js';
import { useFootprint }           from './hooks/useFootprint.js';
import { useMultiExchangeBook }   from './hooks/useMultiExchangeBook.js';
import { useLocalStorage }        from './hooks/useLocalStorage.js';
import { useLiquidations }        from './hooks/useLiquidations.js';
import { useAlerts }              from './hooks/useAlerts.js';
import { Header }                 from './components/Header.jsx';
import { OrderBook }              from './components/OrderBook.jsx';
import { TradeStream }            from './components/TradeStream.jsx';
import { PriceChart, CvdChart }   from './components/Charts.jsx';
import { HeatmapCanvas }          from './components/HeatmapCanvas.jsx';
import { FootprintCanvas }        from './components/FootprintCanvas.jsx';
import { DockviewReact }          from 'dockview-react';
import { TerminalContext }        from './TerminalContext.js';
import { WidgetRegistry }         from './components/WidgetRegistry.jsx';
import { AlertPanel, ToastStrip } from './components/AlertPanel.jsx';
import { fmt as _fmt, fmtQty, fmtTime, SYMBOL_KEYS } from './utils.js';
import { useDeltaFlow }  from './hooks/useDeltaFlow.js';
import { DeltaCanvas }   from './components/DeltaCanvas.jsx';
import { LiqHeatmap }    from './components/LiqHeatmap.jsx';
import { usePortfolio }  from './hooks/usePortfolio.js';
import { OrderEntry }    from './components/OrderEntry.jsx';
import { PositionsPanel } from './components/PositionsPanel.jsx';

const TIMEFRAMES  = ['1m', '5m', '15m', '1h'];
const TF_KEYS     = { t: '1m', y: '5m', u: '15m', i: '1h' };

// Reverse lookup: key letter → symbol
const KEY_TO_SYMBOL = Object.fromEntries(Object.entries(SYMBOL_KEYS).map(([s, k]) => [k.toLowerCase(), s]));

export default function App() {
  const [symbol, setSymbol]               = useLocalStorage('flux_symbol',    'BTCUSDT');
  const [multiExchange, setMultiExchange] = useLocalStorage('flux_multi',     false);
  const [timeframe, setTimeframe]         = useLocalStorage('flux_tf', '1m');
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const layoutApiRef = useRef(null);

  const fmt = useMemo(() => (p) => _fmt(p, symbol), [symbol]);

  const {
    bids: rawBids, asks: rawAsks, trades, ticker,
    klines, cvd, cvdHist, spread: rawSpread, status,
  } = useBinanceStream(symbol, timeframe);

  const { mergeWith, exchangeStatus } = useMultiExchangeBook(symbol, multiExchange);
  const { bids, asks } = useMemo(() =>
    multiExchange ? mergeWith(rawBids, rawAsks) : { bids: rawBids, asks: rawAsks },
    [multiExchange, mergeWith, rawBids, rawAsks]
  );

  const { portfolio, getPositionsWithPnl, placeMarketOrder, closePosition } = usePortfolio();
  
  const markPrices = useMemo(() => (ticker ? { [symbol]: ticker.price } : {}), [ticker, symbol]);
  const activePositions = getPositionsWithPnl(markPrices);
  
  const handlePlaceOrder = useCallback((side, sizeUsd, leverage) => {
    placeMarketOrder(symbol, side, sizeUsd, leverage, bids, asks);
  }, [placeMarketOrder, symbol, bids, asks]);

  // Dockview initialization
  const onReady = useCallback((event) => {
    layoutApiRef.current = event.api;

    const chartPanel = event.api.addPanel({ id: 'chart', component: 'chart', title: 'CHART' });
    
    event.api.addPanel({ id: 'footprint', component: 'footprint', title: 'FOOTPRINT', position: { referencePanel: chartPanel, direction: 'within' } });
    event.api.addPanel({ id: 'heatmap', component: 'heatmap', title: 'HEATMAP', position: { referencePanel: chartPanel, direction: 'within' } });
    
    // Set chart as active tab
    chartPanel.api.setActive();

    const obPanel = event.api.addPanel({ id: 'orderbook', component: 'orderbook', title: 'ORDER BOOK', position: { referencePanel: chartPanel, direction: 'right' } });
    const tradesPanel = event.api.addPanel({ id: 'trades', component: 'trades', title: 'TRADES', position: { referencePanel: obPanel, direction: 'right' } });
    event.api.addPanel({ id: 'orderEntry', component: 'orderEntry', title: 'ORDER ENTRY', position: { referencePanel: tradesPanel, direction: 'top' } });
    event.api.addPanel({ id: 'positions', component: 'positions', title: 'POSITIONS', position: { direction: 'bottom' } });
    
  }, []);

  const spread = useMemo(() =>
    bids[0] && asks[0] ? asks[0].p - bids[0].p : rawSpread,
    [bids, asks, rawSpread]
  );

  const { frames, tradeLog } = useHeatmapData(rawBids, rawAsks, trades, symbol);
  const footprint            = useFootprint(trades, klines, symbol);
  const { liqs }             = useLiquidations(symbol);
  const { alerts, alertPrices, addAlert, removeAlert, checkAlerts,
          triggerLargeTradeAlert, triggerLargeLiqAlert, toasts } = useAlerts(symbol);
  const { buckets: deltaBuckets } = useDeltaFlow(trades);

  // ── Check price alerts on every ticker update ────────────────────────────────
  useEffect(() => {
    if (ticker?.price) checkAlerts(parseFloat(ticker.price));
  }, [ticker?.price, checkAlerts]);

  // ── Large-trade alert — check the newest trade each tick ──────────────────────
  const prevTradeRef = useRef(null);
  useEffect(() => {
    if (!trades || trades.length === 0) return;
    const newest = trades[0];
    if (newest && newest !== prevTradeRef.current) {
      prevTradeRef.current = newest;
      triggerLargeTradeAlert(newest);
    }
  }, [trades, triggerLargeTradeAlert]);

  // ── Large-liquidation alert — check newest liq each update ───────────────────
  const prevLiqRef = useRef(null);
  useEffect(() => {
    if (!liqs || liqs.length === 0) return;
    const newest = liqs[0];
    if (newest && newest !== prevLiqRef.current) {
      prevLiqRef.current = newest;
      triggerLargeLiqAlert(newest);
    }
  }, [liqs, triggerLargeLiqAlert]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();

      // Symbol shortcuts
      if (KEY_TO_SYMBOL[k]) {
        setSymbol(KEY_TO_SYMBOL[k]);
        return;
      }

      // Tab shortcuts
      if (k === '1') { setCenterTab('HEATMAP');   return; }
      if (k === '2') { setCenterTab('CHART');      return; }
      if (k === '3') { setCenterTab('FOOTPRINT');  return; }

      // Feature toggles
      if (k === 'm') { setMultiExchange(v => !v);           return; }
      if (k === 'a') { setShowAlertPanel(v => !v);          return; }
      if (k === 'escape') { setShowAlertPanel(false);       return; }

      // Timeframe shortcuts
      if (TF_KEYS[k]) { setTimeframe(TF_KEYS[k]); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{
      background: '#07090e', color: '#8892a4',
      fontFamily: "'JetBrains Mono', monospace",
      height: '100vh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontSize: '11px',
    }}>
      <Header
        symbol={symbol} setSymbol={setSymbol}
        ticker={ticker} status={status} fmt={fmt}
        multiExchange={multiExchange} setMultiExchange={setMultiExchange}
        alertCount={alerts.filter(a => !a.triggered).length}
        onAlertToggle={() => setShowAlertPanel(v => !v)}
        layoutApiRef={layoutApiRef}
      />

      <TerminalContext.Provider value={{
        symbol, bids, asks, spread, fmt, fmtQty, fmtTime, trades,
        klines, timeframe, cvdHist, cvd, deltaBuckets, liqs,
        frames, tradeLog, alertPrices, ticker,
        portfolio, activePositions, handlePlaceOrder, closePosition,
        multiExchange, exchangeStatus
      }}>
        <div style={{ flex: 1, position: 'relative' }} className="dockview-theme-dark">
          <DockviewReact components={WidgetRegistry} onReady={onReady} />
        </div>
      </TerminalContext.Provider>

      {/* Alert panel */}
      {showAlertPanel && (
        <AlertPanel
          symbol={symbol}
          alerts={alerts}
          onAdd={addAlert}
          onRemove={removeAlert}
          onClose={() => setShowAlertPanel(false)}
          fmt={fmt}
        />
      )}

      {/* Toast notifications */}
      <ToastStrip toasts={toasts} />

      <div style={{
        position: 'fixed', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
        fontSize: '9px', color: '#0d1420', letterSpacing: '2px',
        fontFamily: "'Syne', sans-serif", fontWeight: 700,
        pointerEvents: 'none', userSelect: 'none',
      }}>
        FLUX TERMINAL · LIVE BINANCE DATA
      </div>
    </div>
  );
}
