import { SYMBOLS } from '../utils.js';

const STATUS_COLORS = {
  live:         '#22d3a0',
  connecting:   '#fbbf24',
  reconnecting: '#fbbf24',
  offline:      '#f87171',
  error:        '#f87171',
};

export function Header({ symbol, setSymbol, ticker, status, fmt, multiExchange, setMultiExchange, alertCount = 0, onAlertToggle, layoutApiRef }) {
  const sc = STATUS_COLORS[status] || '#8892a4';

  const handleSaveLayout = () => {
    if (layoutApiRef?.current) {
      const layoutObj = layoutApiRef.current.toJSON();
      localStorage.setItem('flux_saved_layout', JSON.stringify(layoutObj));
      console.log('Layout saved:', layoutObj);
      alert('Layout saved to local storage!');
    }
  };

  const handleLoadLayout = () => {
    if (layoutApiRef?.current) {
      const saved = localStorage.getItem('flux_saved_layout');
      if (saved) {
        layoutApiRef.current.fromJSON(JSON.parse(saved));
      } else {
        alert('No saved layout found.');
      }
    }
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      height: '44px',
      padding: '0 14px',
      borderBottom: '1px solid #0f1520',
      background: '#08090f',
      gap: '18px',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontWeight: 800,
        fontSize: '15px',
        color: '#3b82f6',
        letterSpacing: '-0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '17px', lineHeight: 1 }}>◈</span> FLUX
      </div>

      {/* Symbol tabs */}
      <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
        {SYMBOLS.map(s => {
          const base   = s.replace('USDT', '');
          const active = symbol === s;
          return (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              style={{
                background:    active ? '#0f1e35' : 'transparent',
                border:        `1px solid ${active ? '#1d4ed8' : '#111927'}`,
                color:         active ? '#60a5fa' : '#3d4f63',
                padding:       '2px 6px',
                borderRadius:  '3px',
                fontSize:      '9.5px',
                fontFamily:    "'JetBrains Mono', monospace",
                fontWeight:    600,
                cursor:        'pointer',
                transition:    'all 0.12s',
                outline:       'none',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.color      = '#94a3b8';
                  e.currentTarget.style.background = '#131b27';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.color      = '#3d4f63';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {base}
            </button>
          );
        })}
      </div>

      {/* Multi-exchange toggle */}
      {setMultiExchange && (
        <button
          onClick={() => setMultiExchange(v => !v)}
          title="Aggregate Binance + Bybit + OKX order books"
          style={{
            background:    multiExchange ? 'rgba(249,115,22,0.12)' : 'transparent',
            border:        `1px solid ${multiExchange ? '#f97316' : '#111927'}`,
            color:         multiExchange ? '#f97316' : '#2d3f54',
            padding:       '2px 8px',
            borderRadius:  '3px',
            fontSize:      '9px',
            fontFamily:    "'JetBrains Mono', monospace",
            fontWeight:    700,
            cursor:        'pointer',
            outline:       'none',
            letterSpacing: '0.8px',
            transition:    'all 0.15s',
            flexShrink:    0,
            boxShadow:     multiExchange ? '0 0 8px rgba(249,115,22,0.25)' : 'none',
          }}
        >
          MULTI
        </button>
      )}

      {/* Live price + stats */}
      {ticker && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginLeft: '4px' }}>
          <span style={{
            fontSize:    '19px',
            fontWeight:  700,
            color:       ticker.change >= 0 ? '#22d3a0' : '#f87171',
            letterSpacing: '-1px',
            fontFamily:  "'JetBrains Mono', monospace",
          }}>
            {fmt(ticker.price)}
          </span>

          <div style={{ display: 'flex', gap: '14px', fontSize: '10px' }}>
            {[
              ['24H',  isNaN(ticker.change) ? '—' : `${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)}%`, isNaN(ticker.change) ? '#8892a4' : ticker.change >= 0 ? '#22d3a0' : '#f87171'],
              ['HIGH', fmt(ticker.high), '#94a3b8'],
              ['LOW',  fmt(ticker.low),  '#94a3b8'],
              ['VOL',  `${(ticker.vol / 1000).toFixed(1)}K`, '#94a3b8'],
              ['TVOL', `$${(ticker.qvol / 1_000_000).toFixed(1)}M`, '#94a3b8'],
            ].map(([label, val, col]) => (
              <span key={label}>
                <span style={{ color: '#1a2535' }}>{label} </span>
                <span style={{ color: col }}>{val}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alert bell button */}
      {onAlertToggle && (
        <button
          onClick={onAlertToggle}
          title="Price alerts (A)"
          style={{
            background:    alertCount > 0 ? 'rgba(251,191,36,0.10)' : 'transparent',
            border:        `1px solid ${alertCount > 0 ? '#fbbf24' : '#111927'}`,
            color:         alertCount > 0 ? '#fbbf24' : '#2d3f54',
            padding:       '2px 8px',
            borderRadius:  '3px',
            fontSize:      '11px',
            cursor:        'pointer',
            outline:       'none',
            flexShrink:    0,
            transition:    'all 0.15s',
            boxShadow:     alertCount > 0 ? '0 0 6px rgba(251,191,36,0.3)' : 'none',
            position:      'relative',
          }}
        >
          ⚑{alertCount > 0 && <sup style={{ fontSize: '8px', marginLeft: '1px' }}>{alertCount}</sup>}
        </button>
      )}

      {/* Layout buttons */}
      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
        <button
          onClick={handleLoadLayout}
          title="Load saved layout"
          style={{
            background:    'transparent',
            border:        `1px solid #111927`,
            color:         '#60a5fa',
            padding:       '2px 8px',
            borderRadius:  '3px',
            fontSize:      '9.5px',
            fontFamily:    "'JetBrains Mono', monospace",
            fontWeight:    600,
            cursor:        'pointer',
            outline:       'none',
            transition:    'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#131b27'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          LOAD
        </button>
        <button
          onClick={handleSaveLayout}
          title="Save layout to local storage"
          style={{
            background:    'transparent',
            border:        `1px solid #111927`,
            color:         '#fbbf24',
            padding:       '2px 8px',
            borderRadius:  '3px',
            fontSize:      '9.5px',
            fontFamily:    "'JetBrains Mono', monospace",
            fontWeight:    600,
            cursor:        'pointer',
            outline:       'none',
            transition:    'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#131b27'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          SAVE
        </button>
      </div>

      {/* Connection status */}
      <div style={{
        marginLeft: 'auto',
        display:    'flex',
        alignItems: 'center',
        gap:        '6px',
        fontSize:   '10px',
        color:      sc,
        flexShrink: 0,
      }}>
        <div
          className={status === 'live' ? 'status-live-dot' : ''}
          style={{
            width:        '5px',
            height:       '5px',
            borderRadius: '50%',
            background:   sc,
            boxShadow:    status === 'live' ? `0 0 8px ${sc}` : 'none',
          }}
        />
        {status.toUpperCase()}
      </div>
    </header>
  );
}
