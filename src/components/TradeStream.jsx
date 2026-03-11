import { useMemo } from 'react';
import { computeBuyPct } from '../utils.js';

export function TradeStream({ trades, fmt, fmtQty, fmtTime }) {
  const buyPct = useMemo(() => computeBuyPct(trades), [trades]);
  const sellPct = 100 - buyPct;

  return (
    <div style={{
      width:       '230px',
      flexShrink:  0,
      borderLeft:  '1px solid #0f1520',
      display:     'flex',
      flexDirection: 'column',
      background:  '#08090f',
      overflow:    'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:       '7px 12px',
        borderBottom:  '1px solid #0f1520',
        display:       'flex',
        justifyContent: 'space-between',
        alignItems:    'center',
        flexShrink:    0,
      }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: 700, color: '#1e2d40', letterSpacing: '1.5px' }}>
          TRADES
        </span>
        <span style={{ fontSize: '9px', color: '#1a2535' }}>{trades.length} recent</span>
      </div>

      {/* Column labels */}
      <div style={{
        display:       'flex',
        justifyContent: 'space-between',
        padding:       '3px 12px',
        color:         '#192030',
        fontSize:      '9.5px',
        borderBottom:  '1px solid #0c1018',
        flexShrink:    0,
        fontFamily:    "'JetBrains Mono', monospace",
      }}>
        <span>TIME</span><span>PRICE</span><span>QTY</span>
      </div>

      {/* Trade rows */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {trades.map((t, i) => {
          const isNew = i === 0;
          const color = t.isBuy ? '#22d3a0' : '#f87171';
          return (
            <div
              key={t.id}
              className={isNew ? (t.isBuy ? 'trade-buy-flash trade-new' : 'trade-sell-flash trade-new') : ''}
              style={{
                display:       'flex',
                justifyContent: 'space-between',
                padding:       '2.5px 12px',
                borderBottom:  '1px solid #09111a',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              <span style={{ color: '#1e2d3d', fontSize: '9.5px', fontFamily: "'JetBrains Mono', monospace" }}>
                {fmtTime(t.time)}
              </span>
              <span style={{ color, fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt(t.price)}
              </span>
              <span style={{ color: '#2d3f54', fontSize: '10.5px', fontFamily: "'JetBrains Mono', monospace" }}>
                {fmtQty(t.qty)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Buy / Sell pressure bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #0f1520', background: '#07090e', flexShrink: 0 }}>
        <div style={{
          display:       'flex',
          justifyContent: 'space-between',
          marginBottom:  '5px',
          fontSize:      '9.5px',
          fontFamily:    "'JetBrains Mono', monospace",
        }}>
          <span style={{ color: '#22d3a0' }}>B {buyPct.toFixed(0)}%</span>
          <span style={{ color: '#192030', letterSpacing: '1.5px', fontSize: '8.5px' }}>PRESSURE</span>
          <span style={{ color: '#f87171' }}>S {sellPct.toFixed(0)}%</span>
        </div>
        <div style={{ height: '3px', borderRadius: '2px', background: '#f87171', overflow: 'hidden' }}>
          <div style={{
            height:       '100%',
            width:        `${buyPct}%`,
            background:   '#22d3a0',
            borderRadius: '2px',
            transition:   'width 0.35s ease',
          }} />
        </div>
      </div>
    </div>
  );
}
