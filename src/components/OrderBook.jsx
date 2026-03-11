import { useMemo } from 'react';
import { BUCKET_SIZES } from '../utils.js';
import { EXCHANGE_COLORS } from '../hooks/useMultiExchangeBook.js';

function PanelLabel({ children }) {
  return (
    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: 700, color: '#1e2d40', letterSpacing: '1.5px' }}>
      {children}
    </span>
  );
}

// Small colored dots showing which exchange(s) have qty at this level
function ExchangeDots({ sources }) {
  if (!sources) return null;
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
      {(['binance', 'bybit', 'okx']).map(ex => sources[ex] > 0 ? (
        <div key={ex} title={`${ex}: ${sources[ex].toFixed(4)}`} style={{
          width: '4px', height: '4px', borderRadius: '50%',
          background: EXCHANGE_COLORS[ex],
          opacity: 0.85,
          flexShrink: 0,
        }} />
      ) : null)}
    </div>
  );
}

function BookRow({ p, q, pct, side, sources, fmtPrice, fmtQty }) {
  const isAsk    = side === 'ask';
  const barColor = isAsk ? 'rgba(248,113,113,0.09)' : 'rgba(34,211,160,0.09)';
  const txtColor = isAsk ? '#f87171' : '#22d3a0';
  const isMulti  = !!sources;

  return (
    <div
      style={{
        position: 'relative', padding: '2px 8px 2px 8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'default', gap: '4px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Volume bar */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: `${pct * 100}%`, background: barColor, transition: 'width 0.1s ease',
      }} />

      <span style={{ color: txtColor, position: 'relative', zIndex: 1, fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", minWidth: 0 }}>
        {fmtPrice(p)}
      </span>

      {/* Exchange dots (multi-exchange mode only) */}
      {isMulti && <ExchangeDots sources={sources} />}

      <span style={{ color: '#2d3f54', position: 'relative', zIndex: 1, fontSize: '10.5px', whiteSpace: 'nowrap' }}>
        {fmtQty(q)}
      </span>
    </div>
  );
}

export function OrderBook({ bids, asks, spread, symbol, fmt, fmtQty, multiExchange, exchangeStatus }) {
  const bucketLabel  = BUCKET_SIZES[symbol] || 1;
  const displayAsks  = useMemo(() => [...asks].reverse(), [asks]);

  // Calculate volume imbalance (bids vs asks)
  const [bidVol, askVol] = useMemo(() => {
    const b = bids.reduce((sum, lvl) => sum + lvl.q, 0);
    const a = asks.reduce((sum, lvl) => sum + lvl.q, 0);
    return [b, a];
  }, [bids, asks]);

  const totalVol   = bidVol + askVol || 1;
  const bidPct     = (bidVol / totalVol) * 100;

  return (
    <div style={{
      width: '220px', flexShrink: 0, borderRight: '1px solid #0f1520',
      display: 'flex', flexDirection: 'column', background: '#08090f', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '7px 10px', borderBottom: '1px solid #0f1520', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '6px' }}>
        <PanelLabel>ORDER BOOK</PanelLabel>

        {/* Exchange status dots (multi mode) */}
        {multiExchange && exchangeStatus && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {(['binance', 'bybit', 'okx']).map(ex => {
              const st = ex === 'binance' ? 'live' : (exchangeStatus[ex] || 'off');
              return (
                <div key={ex} title={`${ex}: ${st}`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <div style={{
                    width: '5px', height: '5px', borderRadius: '50%',
                    background: st === 'live' ? EXCHANGE_COLORS[ex] : '#1a2535',
                    boxShadow: st === 'live' ? `0 0 4px ${EXCHANGE_COLORS[ex]}` : 'none',
                    transition: 'all 0.3s',
                  }} />
                </div>
              );
            })}
          </div>
        )}

        <span style={{ fontSize: '9px', color: '#1a2535', background: '#0d1420', padding: '1px 5px', borderRadius: '2px', marginLeft: multiExchange ? 0 : 'auto', flexShrink: 0 }}>
          Δ{bucketLabel}
        </span>
      </div>

      {/* Column headers */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', color: '#192030', fontSize: '9.5px', borderBottom: '1px solid #0c1018', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
        <span>PRICE</span>
        {multiExchange && <span style={{ color: '#0d1825', fontSize: '8px' }}>BNC·BBT·OKX</span>}
        <span>SIZE</span>
      </div>

      {/* Asks (reversed — lowest ask nearest spread) */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: 0 }}>
        {displayAsks.map((lv, i) => (
          <BookRow key={i} side="ask" fmtPrice={p => fmt(p)} fmtQty={fmtQty} {...lv} />
        ))}
      </div>

      {/* Spread & Imbalance */}
      <div style={{
        padding: '5px 10px', background: '#0b0e16',
        borderTop: '1px solid #0c1018', borderBottom: '1px solid #0c1018',
        display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#1a2535', fontSize: '9.5px', fontFamily: "'JetBrains Mono', monospace" }}>SPREAD</span>
          <span style={{ color: '#fbbf24', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
            {spread != null ? spread.toFixed(spread < 1 ? 4 : 2) : '—'}
          </span>
        </div>

        {/* Imbalance Bar */}
        <div style={{ position: 'relative', height: '3px', background: '#111927', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${bidPct}%`, background: '#22d3a0', transition: 'width 0.2s ease', opacity: 0.8 }} />
          <div style={{ flex: 1, background: '#f87171', opacity: 0.8 }} />
        </div>
      </div>

      {/* Bids */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {bids.map((lv, i) => (
          <BookRow key={i} side="bid" fmtPrice={p => fmt(p)} fmtQty={fmtQty} {...lv} />
        ))}
      </div>
    </div>
  );
}
