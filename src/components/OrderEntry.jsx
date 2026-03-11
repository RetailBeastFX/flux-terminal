import { useState } from 'react';
import { fmtQty } from '../utils.js';

function PanelLabel({ children }) {
  return (
    <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: 700, color: '#1e2d40', letterSpacing: '1.5px' }}>
      {children}
    </span>
  );
}

export function OrderEntry({ symbol, currentPrice, onPlaceOrder }) {
  const [sizeUsd, setSizeUsd] = useState('10000');
  const [leverage, setLeverage] = useState(10);
  
  const handleBuy = () => {
    const s = parseFloat(sizeUsd);
    if (!isNaN(s) && s > 0) onPlaceOrder('long', s, leverage);
  };
  
  const handleSell = () => {
    const s = parseFloat(sizeUsd);
    if (!isNaN(s) && s > 0) onPlaceOrder('short', s, leverage);
  };

  const coinSize = currentPrice ? (parseFloat(sizeUsd) || 0) / currentPrice : 0;
  const marginReq = (parseFloat(sizeUsd) || 0) / leverage;

  return (
    <div style={{
      width: '100%', flexShrink: 0, borderLeft: '1px solid #0f1520',
      display: 'flex', flexDirection: 'column', background: '#08090f',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ padding: '7px 10px', borderBottom: '1px solid #0f1520', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <PanelLabel>ORDER ENTRY</PanelLabel>
        <span style={{ fontSize: '9px', color: '#1a2535', background: '#0d1420', padding: '1px 5px', borderRadius: '2px' }}>
          MARKET
        </span>
      </div>

      <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Size Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#2d3f54' }}>
            <span>Size (USD)</span>
            <span>≈ {fmtQty(coinSize)} {symbol.replace('USDT', '')}</span>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', fontSize: '11px' }}>$</span>
            <input 
              type="number"
              value={sizeUsd}
              onChange={e => setSizeUsd(e.target.value)}
              style={{
                width: '100%', background: '#0b0e16', border: '1px solid #111927',
                color: '#e2e8f0', padding: '6px 8px 6px 20px', fontSize: '12px',
                fontFamily: "'JetBrains Mono', monospace", outline: 'none',
                borderRadius: '3px'
              }}
            />
          </div>
        </div>

        {/* Leverage Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#2d3f54' }}>
            <span>Leverage</span>
            <span style={{ color: '#60a5fa' }}>{leverage}x</span>
          </div>
          <input 
            type="range" min="1" max="100" value={leverage}
            onChange={e => setLeverage(parseInt(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#1a2535', marginTop: '-2px' }}>
            <span>1x</span><span>20x</span><span>50x</span><span>100x</span>
          </div>
        </div>

        {/* Margin Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', padding: '6px 0', borderTop: '1px dashed #111927', borderBottom: '1px dashed #111927' }}>
          <span>Cost (Margin)</span>
          <span style={{ color: '#e2e8f0' }}>${marginReq.toFixed(2)}</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button onClick={handleBuy} style={{
            flex: 1, background: 'rgba(34,211,160,0.1)', border: '1px solid rgba(34,211,160,0.3)',
            color: '#22d3a0', padding: '10px 0', borderRadius: '3px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.1s', outline: 'none'
          }} onMouseOver={e => e.currentTarget.style.background='rgba(34,211,160,0.2)'} onMouseOut={e => e.currentTarget.style.background='rgba(34,211,160,0.1)'}>
            Buy / Long
          </button>
          <button onClick={handleSell} style={{
            flex: 1, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#f87171', padding: '10px 0', borderRadius: '3px', cursor: 'pointer',
            fontSize: '11px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.1s', outline: 'none'
          }} onMouseOver={e => e.currentTarget.style.background='rgba(248,113,113,0.2)'} onMouseOut={e => e.currentTarget.style.background='rgba(248,113,113,0.1)'}>
            Sell / Short
          </button>
        </div>

      </div>
    </div>
  );
}
