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
import { Splitter }               from './components/Splitter.jsx';
import { AlertPanel, ToastStrip } from './components/AlertPanel.jsx';
import { fmt as _fmt, fmtQty, fmtTime, SYMBOL_KEYS } from './utils.js';
import { useDeltaFlow }  from './hooks/useDeltaFlow.js';
import { DeltaCanvas }   from './components/DeltaCanvas.jsx';
import { LiqHeatmap }    from './components/LiqHeatmap.jsx';

const CENTER_TABS = ['HEATMAP', 'CHART', 'FOOTPRINT'];
const TIMEFRAMES  = ['1m', '5m', '15m', '1h'];
const TF_KEYS     = { t: '1m', y: '5m', u: '15m', i: '1h' };
const OB_MIN = 160, OB_MAX = 360, OB_DEFAULT = 220;
const TS_MIN = 170, TS_MAX = 380, TS_DEFAULT = 240;

// Reverse lookup: key letter → symbol
const KEY_TO_SYMBOL = Object.fromEntries(Object.entries(SYMBOL_KEYS).map(([s, k]) => [k.toLowerCase(), s]));

function useDragResize(storageKey, defaultW, min, max) {
  const [width, setWidth] = useLocalStorage(storageKey, defaultW);
  const widthRef          = useRef(width);

  const onDragStart = useCallback((startX, direction = 1) => {
    const startW  = widthRef.current;
    const rafRef  = { current: null };
    const onMove  = (e) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const next = Math.min(max, Math.max(min, startW + (e.clientX - startX) * direction));
        widthRef.current = next;
        setWidth(next);
      });
    };
    const onUp = () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }, [min, max, setWidth]);

  widthRef.current = width;
  return [width, onDragStart];
}

export default function App() {
  const [symbol, setSymbol]               = useLocalStorage('flux_symbol',    'BTCUSDT');
  const [centerTab, setCenterTab]         = useLocalStorage('flux_tab',       'HEATMAP');
  const [multiExchange, setMultiExchange] = useLocalStorage('flux_multi',     false);
  const [timeframe, setTimeframe]         = useLocalStorage('flux_timeframe', '1m');
  const [showAlertPanel, setShowAlertPanel] = useState(false);

  const [obW, startDragOB] = useDragResize('flux_ob_w', OB_DEFAULT, OB_MIN, OB_MAX);
  const [tsW, startDragTS] = useDragResize('flux_ts_w', TS_DEFAULT, TS_MIN, TS_MAX);

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
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        <div style={{ width: `${obW}px`, flexShrink: 0, display: 'flex', minHeight: 0 }}>
          <OrderBook
            bids={bids} asks={asks} spread={spread}
            symbol={symbol} fmt={fmt} fmtQty={fmtQty}
            multiExchange={multiExchange} exchangeStatus={exchangeStatus}
          />
        </div>

        <Splitter onDragStart={(x) => startDragOB(x, 1)} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            padding: '4px 10px', borderBottom: '1px solid #0f1520',
            background: '#08090f', flexShrink: 0,
          }}>
            {CENTER_TABS.map((tab, idx) => {
              const active = centerTab === tab;
              return (
                <button key={tab} onClick={() => setCenterTab(tab)} style={{
                  background:   active ? '#0f1e35' : 'transparent',
                  border:       `1px solid ${active ? '#1d4ed8' : '#111927'}`,
                  color:        active ? '#60a5fa' : '#2d3f54',
                  padding:      '2px 8px', borderRadius: '3px',
                  fontSize:     '9.5px', fontFamily: "'JetBrains Mono', monospace",
                  fontWeight:   600, cursor: 'pointer', outline: 'none',
                  letterSpacing: '1px', transition: 'all 0.1s',
                  title:        `[${idx + 1}]`,
                }}>
                  {tab}
                </button>
              );
            })}

            {/* Keyboard hint */}
            <span style={{ fontSize: '8px', color: '#0c1420', marginLeft: '6px', letterSpacing: '0.5px' }}>
              B·E·S·N·X·D·V·C·L·O  ·  1·2·3  ·  M·[A]LERT  ·  T·Y·U·I=TF
            </span>

            <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#1a2535' }}>
              {centerTab === 'HEATMAP'   && `${frames.length} frames`}
              {centerTab === 'CHART'     && `${klines.length} klines`}
              {centerTab === 'FOOTPRINT' && `${footprint.length} candles`}
            </span>
          </div>

          {/* Timeframe selector — shown when CHART or FOOTPRINT is active */}
          {(centerTab === 'CHART' || centerTab === 'FOOTPRINT') && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '3px 10px', borderBottom: '1px solid #0a1220',
              background: '#06080d', flexShrink: 0,
            }}>
              <span style={{ fontSize: '8px', color: '#1a2535', marginRight: '4px', letterSpacing: '1px' }}>TF</span>
              {TIMEFRAMES.map((tf, i) => {
                const active = timeframe === tf;
                return (
                  <button key={tf} onClick={() => setTimeframe(tf)} style={{
                    background:    active ? '#0c1a30' : 'transparent',
                    border:        `1px solid ${active ? '#1d4ed8' : '#0d1825'}`,
                    color:         active ? '#60a5fa' : '#1a2d40',
                    padding:       '1px 7px', borderRadius: '3px',
                    fontSize:      '9px', fontFamily: "'JetBrains Mono', monospace",
                    fontWeight:    600, cursor: 'pointer', outline: 'none',
                    transition:    'all 0.1s',
                    title:         ['T','Y','U','I'][i],
                  }}>
                    {tf}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {centerTab === 'HEATMAP'   && <HeatmapCanvas  frames={frames} tradeLog={tradeLog} liqs={liqs} alertPrices={alertPrices} symbol={symbol} />}
            {centerTab === 'CHART'     && <PriceChart      klines={klines} fmt={fmt} timeframe={timeframe} />}
            {centerTab === 'FOOTPRINT' && <FootprintCanvas footprint={footprint} symbol={symbol} />}
          </div>

          <CvdChart cvdHist={cvdHist} cvd={cvd} />
          <DeltaCanvas buckets={deltaBuckets} />
          <LiqHeatmap liqs={liqs} />
        </div>

        <Splitter onDragStart={(x) => startDragTS(x, -1)} />

        <div style={{ width: `${tsW}px`, flexShrink: 0, display: 'flex', minHeight: 0 }}>
          <TradeStream trades={trades} fmt={fmt} fmtQty={fmtQty} fmtTime={fmtTime} />
        </div>

      </div>

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
