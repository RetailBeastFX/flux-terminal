import { useTerminal } from '../TerminalContext.js';
import { OrderBook } from './OrderBook.jsx';
import { TradeStream } from './TradeStream.jsx';
import { PriceChart, CvdChart } from './Charts.jsx';
import { HeatmapCanvas } from './HeatmapCanvas.jsx';
import { FootprintCanvas } from './FootprintCanvas.jsx';
import { DeltaCanvas } from './DeltaCanvas.jsx';
import { LiqHeatmap } from './LiqHeatmap.jsx';
import { OrderEntry } from './OrderEntry.jsx';
import { PositionsPanel } from './PositionsPanel.jsx';

export const WidgetRegistry = {
  orderbook: (props) => {
    const { bids, asks, spread, symbol, fmt, fmtQty, multiExchange, exchangeStatus } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', overflow: 'hidden', display: 'flex' }}>
        <OrderBook bids={bids} asks={asks} spread={spread} symbol={symbol} fmt={fmt} fmtQty={fmtQty} multiExchange={multiExchange} exchangeStatus={exchangeStatus} />
      </div>
    );
  },
  
  trades: (props) => {
    const { trades, fmt, fmtQty, fmtTime } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', overflow: 'hidden', display: 'flex' }}>
        <TradeStream trades={trades} fmt={fmt} fmtQty={fmtQty} fmtTime={fmtTime} />
      </div>
    );
  },
  
  chart: (props) => {
    const { klines, fmt, timeframe, cvdHist, cvd, deltaBuckets, liqs } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}><PriceChart klines={klines} fmt={fmt} timeframe={timeframe} /></div>
        <CvdChart cvdHist={cvdHist} cvd={cvd} />
        <DeltaCanvas buckets={deltaBuckets} />
        <LiqHeatmap liqs={liqs} />
      </div>
    );
  },
  
  heatmap: (props) => {
    const { frames, tradeLog, liqs, alertPrices, symbol, cvdHist, cvd, deltaBuckets } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}><HeatmapCanvas frames={frames} tradeLog={tradeLog} liqs={liqs} alertPrices={alertPrices} symbol={symbol} /></div>
        <CvdChart cvdHist={cvdHist} cvd={cvd} />
        <DeltaCanvas buckets={deltaBuckets} />
        <LiqHeatmap liqs={liqs} />
      </div>
    );
  },
  
  footprint: (props) => {
    const { footprint, symbol, cvdHist, cvd, deltaBuckets, liqs } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}><FootprintCanvas footprint={footprint} symbol={symbol} /></div>
        <CvdChart cvdHist={cvdHist} cvd={cvd} />
        <DeltaCanvas buckets={deltaBuckets} />
        <LiqHeatmap liqs={liqs} />
      </div>
    );
  },
  
  orderEntry: (props) => {
    const { symbol, ticker, handlePlaceOrder } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', overflow: 'hidden', display: 'flex' }}>
        <OrderEntry symbol={symbol} currentPrice={ticker?.price} onPlaceOrder={handlePlaceOrder} />
      </div>
    );
  },

  positions: (props) => {
    const { portfolio, activePositions, closePosition } = useTerminal();
    return (
      <div style={{ height: '100%', width: '100%', overflow: 'hidden', display: 'flex' }}>
        <PositionsPanel balance={portfolio.balance} positions={activePositions} onClosePosition={closePosition} />
      </div>
    );
  }
};
