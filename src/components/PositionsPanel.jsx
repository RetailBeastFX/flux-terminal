import { fmtQty } from '../utils.js';

function PanelLabel({ children }) {
  return (
    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: 700, color: '#1e2d40', letterSpacing: '1.5px' }}>
      {children}
    </span>
  );
}

function PnlColor({ val, format }) {
  const isPos = val >= 0;
  const color = isPos ? '#22d3a0' : '#f87171';
  return <span style={{ color }}>{isPos ? '+' : ''}{format(val)}</span>;
}

export function PositionsPanel({ balance, positions, onClosePosition }) {
  return (
    <div style={{
      height: '140px', flexShrink: 0, borderTop: '1px solid #0f1520',
      display: 'flex', flexDirection: 'column', background: '#08090f',
      fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#8892a4'
    }}>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #0f1520', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <PanelLabel>POSITIONS</PanelLabel>
          <span style={{ fontSize: '9px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '2px' }}>
            Balance: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <span style={{ fontSize: '9px', color: '#1a2535' }}>
          {positions.length} Open
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {positions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#1a2535', fontSize: '10px' }}>
            No active positions
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#0a1220', color: '#4b5563', fontSize: '9px', zIndex: 1 }}>
              <tr>
                <th style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 'normal' }}>Symbol</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Size (USD)</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Size (Coin)</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Entry Price</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Mark Price</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Liq. Price</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Margin Ratio</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Unrealized PNL</th>
                <th style={{ padding: '6px 12px', fontWeight: 'normal' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => {
                const isLong = pos.side === 'long';
                return (
                  <tr key={pos.symbol} style={{ borderBottom: '1px solid #0c1018', background: 'transparent', transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background='#0b111a'} onMouseOut={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding: '8px 12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '3px', height: '12px', background: isLong ? '#22d3a0' : '#f87171', borderRadius: '1.5px' }} />
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{pos.symbol}</span>
                      <span style={{ fontSize: '9px', color: isLong ? '#22d3a0' : '#f87171', background: isLong ? 'rgba(34,211,160,0.1)' : 'rgba(248,113,113,0.1)', padding: '1px 4px', borderRadius: '2px' }}>
                        {pos.leverage}x
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#e2e8f0' }}>${fmtQty(pos.sizeUsd)}</td>
                    <td style={{ padding: '8px 12px' }}>{fmtQty(pos.sizeCoin)}</td>
                    <td style={{ padding: '8px 12px' }}>{pos.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{pos.markPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 12px', color: '#fbbf24' }}>{pos.liqPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '8px 12px' }}>{pos.marginRatio.toFixed(2)}%</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                      <PnlColor val={pos.uPnl} format={v => `$${Math.abs(v).toFixed(2)}`} />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button 
                        onClick={() => onClosePosition(pos.symbol, pos.markPrice)}
                        style={{
                          background: 'transparent', border: '1px solid #1e2d40', color: '#94a3b8',
                          padding: '3px 8px', borderRadius: '3px', cursor: 'pointer',
                          fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", outline: 'none'
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = '#fbbf24'; e.currentTarget.style.color = '#fbbf24'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = '#1e2d40'; e.currentTarget.style.color = '#94a3b8'; }}
                      >
                        Market Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
