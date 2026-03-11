import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { useIndicators } from '../hooks/useIndicators.js';
import { useLiquiditySweeps } from '../hooks/useLiquiditySweeps.js';

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div style={{
      background:   '#0c1220',
      border:       '1px solid #1e2d40',
      borderRadius: '4px',
      padding:      '5px 9px',
      fontSize:     '11px',
      fontFamily:   "'JetBrains Mono', monospace",
      color:        '#60a5fa',
    }}>
      <div style={{ color: '#3d5068', marginBottom: '2px', fontSize: '9.5px' }}>{label}</div>
      <div>{formatter ? formatter(val) : val}</div>
    </div>
  );
}

// ─── Price Chart ─────────────────────────────────────────────────────────────
const TF_INTERVALS = { '1m': 23, '5m': 11, '15m': 7, '1h': 5, '4h': 3 };

export function PriceChart({ klines, fmt, timeframe = '1m' }) {
  const xInterval = TF_INTERVALS[timeframe] ?? 23;
  const enrichedKlines = useIndicators(klines);
  const { sweeps, activePivots } = useLiquiditySweeps(klines);

  return (
    <div style={{ flex: 1, position: 'relative', padding: '4px 0 0' }}>
      <div style={{
        position:      'absolute',
        top:           '10px',
        left:          '14px',
        fontFamily:    "'Syne', sans-serif",
        fontSize:      '10px',
        fontWeight:    700,
        color:         '#1a2535',
        letterSpacing: '1.5px',
        zIndex:        2,
        pointerEvents: 'none',
      }}>
        PRICE · {timeframe.toUpperCase()}
      </div>

      <div style={{
        position: 'absolute', top: 10, right: 60, zIndex: 2, pointerEvents: 'none',
        display: 'flex', gap: '8px', fontSize: '9px', fontFamily: "'JetBrains Mono', monospace"
      }}>
        <span style={{ color: '#fbbf24' }}>EMA8</span>
        <span style={{ color: '#f87171' }}>EMA21</span>
        <span style={{ color: '#c084fc' }}>VWAP</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={enrichedKlines} margin={{ top: 24, right: 56, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id="price-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}    />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="time"
            tick={{ fill: '#1a2535', fontSize: 9, fontFamily: "'JetBrains Mono'" }}
            tickLine={false}
            axisLine={false}
            interval={xInterval}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#1a2535', fontSize: 9, fontFamily: "'JetBrains Mono'" }}
            tickLine={false}
            axisLine={false}
            orientation="right"
            width={60}
            tickFormatter={v => v.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          />
          <Tooltip
            content={<ChartTooltip formatter={v => fmt(v)} />}
            cursor={{ stroke: '#1e2d40', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          <Area
            type="monotone" dataKey="c"
            stroke="#3b82f6" strokeWidth={1.5} fill="url(#price-grad)"
            dot={false} activeDot={{ r: 3, fill: '#93c5fd', strokeWidth: 0 }}
            isAnimationActive={false}
          />

          {/* Unbroken Pivots (Liquidity Pools) */}
          {activePivots?.map((p, i) => (
            <ReferenceLine 
              key={`piv-${i}`} y={p.price} 
              stroke={p.type === 'high' ? 'rgba(248,113,113,0.3)' : 'rgba(34,211,160,0.3)'} 
              strokeDasharray="4 4" strokeWidth={1}
            />
          ))}

          {/* Sweeps (Stop Hunts) */}
          {sweeps?.map((s, i) => (
            <ReferenceDot 
              key={`swp-${i}`} x={s.time} y={s.price} r={4}
              fill={s.type === 'sweep_high' ? '#f87171' : '#22d3a0'} stroke="none"
              label={{ position: s.type === 'sweep_high' ? 'top' : 'bottom', value: 'SWEEP', fill: '#e2e8f0', fontSize: 8, fontFamily: 'monospace' }}
            />
          ))}

          <Line type="monotone" dataKey="ema8" stroke="#fbbf24" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="ema21" stroke="#f87171" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="vwap" stroke="#c084fc" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── CVD Chart ───────────────────────────────────────────────────────────────
export function CvdChart({ cvdHist, cvd }) {
  const isPositive = cvd >= 0;
  const color      = isPositive ? '#22d3a0' : '#f87171';
  const gradId     = isPositive ? 'cvd-grad-pos' : 'cvd-grad-neg';

  const data = cvdHist.map((d, i) => ({ i, cvd: d.cvd }));

  return (
    <div style={{ height: '92px', borderTop: '1px solid #0f1520', position: 'relative', padding: '2px 0 0' }}>
      {/* Label + live value */}
      <div style={{
        position:      'absolute',
        top:           '7px',
        left:          '14px',
        fontFamily:    "'Syne', sans-serif",
        fontSize:      '9.5px',
        fontWeight:    700,
        color:         '#1a2535',
        letterSpacing: '1.5px',
        zIndex:        2,
        display:       'flex',
        gap:           '8px',
        alignItems:    'center',
        pointerEvents: 'none',
      }}>
        <span>CVD</span>
        <span style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>
          {cvd >= 0 ? '+' : ''}{cvd.toFixed(2)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 18, right: 56, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <YAxis domain={['auto', 'auto']} hide />
          <XAxis dataKey="i" hide />
          <ReferenceLine y={0} stroke="#1a2535" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="cvd"
            stroke={color}
            strokeWidth={1.2}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
