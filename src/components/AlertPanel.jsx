import { useState, useCallback } from 'react';

export function AlertPanel({ symbol, alerts, onAdd, onRemove, onClose, fmt }) {
  const [inputVal, setInputVal] = useState('');
  const [error, setError]       = useState('');

  const handleAdd = useCallback(() => {
    const price = parseFloat(inputVal.replace(/,/g, ''));
    if (isNaN(price) || price <= 0) { setError('Enter a valid price'); return; }
    onAdd(price);
    setInputVal('');
    setError('');
  }, [inputVal, onAdd]);

  const handleKey = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') onClose();
  };

  const active  = alerts.filter(a => !a.triggered);
  const fired   = alerts.filter(a => a.triggered);

  return (
    <div style={{
      position:   'fixed', top: '54px', right: '16px',
      width:      '240px', zIndex: 9999,
      background: '#0c0f1a', border: '1px solid #1d4ed8',
      borderRadius: '6px', padding: '12px',
      boxShadow: '0 8px 32px rgba(0,0,60,0.6)',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ color: '#60a5fa', fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px' }}>
          ⚑ PRICE ALERTS · {symbol.replace('USDT', '')}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#2d3f54', cursor: 'pointer', fontSize: '13px', padding: '0 2px' }}>✕</button>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input
          autoFocus
          type="text"
          placeholder="e.g. 70000"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setError(''); }}
          onKeyDown={handleKey}
          style={{
            flex: 1, background: '#0a0d16', border: '1px solid #1a2535',
            color: '#8892a4', padding: '4px 8px', borderRadius: '3px',
            fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            background: '#1d4ed8', border: 'none', color: '#93c5fd',
            padding: '4px 10px', borderRadius: '3px', cursor: 'pointer',
            fontSize: '10px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          SET
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '9.5px', marginBottom: '6px' }}>{error}</div>}

      {/* Active alerts */}
      {active.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '8.5px', color: '#1e2d40', letterSpacing: '1px', marginBottom: '4px' }}>WATCHING</div>
          {active.map(al => (
            <div key={al.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 6px', background: 'rgba(147,105,255,0.08)',
              border: '1px solid rgba(147,105,255,0.2)', borderRadius: '2px',
              marginBottom: '3px',
            }}>
              <span style={{ color: '#c4b5fd', fontSize: '10.5px' }}>⚑ {fmt(al.price)}</span>
              <button onClick={() => onRemove(al.id)} style={{
                background: 'none', border: 'none', color: '#2d3f54',
                cursor: 'pointer', fontSize: '11px', padding: '0',
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Fired alerts */}
      {fired.length > 0 && (
        <div>
          <div style={{ fontSize: '8.5px', color: '#1e2d40', letterSpacing: '1px', marginBottom: '4px' }}>TRIGGERED</div>
          {fired.map(al => (
            <div key={al.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '3px 6px', background: 'rgba(251,191,36,0.07)',
              border: '1px solid rgba(251,191,36,0.2)', borderRadius: '2px',
              marginBottom: '3px',
            }}>
              <span style={{ color: '#fbbf24', fontSize: '10.5px' }}>✓ {fmt(al.price)}</span>
              <button onClick={() => onRemove(al.id)} style={{
                background: 'none', border: 'none', color: '#2d3f54',
                cursor: 'pointer', fontSize: '11px', padding: '0',
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {active.length === 0 && fired.length === 0 && (
        <div style={{ color: '#1a2535', fontSize: '9.5px', textAlign: 'center', padding: '8px 0' }}>
          No active alerts
        </div>
      )}

      {/* Keyboard hint */}
      <div style={{ marginTop: '8px', borderTop: '1px solid #0f1520', paddingTop: '8px',
        fontSize: '8px', color: '#0d1825', textAlign: 'center' }}>
        Press A to toggle · Enter to add · Esc to close
      </div>
    </div>
  );
}

// Toast color + glow per alert type
const TOAST_STYLES = {
  price:      { border: '#fbbf24', color: '#fbbf24', glow: '251,191,36' },
  large_buy:  { border: '#00e57a', color: '#00e57a', glow: '0,229,122' },
  large_sell: { border: '#f0304a', color: '#ff6080', glow: '240,48,74' },
  liq_long:   { border: '#38bdf8', color: '#7dd3fc', glow: '56,189,248' },
  liq_short:  { border: '#e879f9', color: '#f0abfc', glow: '232,121,249' },
};

// Toast notification strip
export function ToastStrip({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '6px', alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const st = TOAST_STYLES[t.type] || TOAST_STYLES.price;
        return (
          <div key={t.id} style={{
            background:    '#0c0f1a',
            border:        `1px solid ${st.border}`,
            borderRadius:  '4px',
            padding:       '6px 16px',
            fontSize:      '11px',
            color:         st.color,
            fontFamily:    "'JetBrains Mono', monospace",
            fontWeight:    700,
            letterSpacing: '0.5px',
            boxShadow:     `0 4px 20px rgba(${st.glow},0.35)`,
            whiteSpace:    'nowrap',
          }}>
            {t.icon || '⚑'} {t.message}
          </div>
        );
      })}
    </div>
  );
}
