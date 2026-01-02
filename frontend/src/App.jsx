import Header from "./components/header/Header.jsx";
import StockInfo from "./components/stockInfo/StockInfo.jsx";
import Order from "./components/order/Order.jsx";
import StockChart from "./components/chart/StockChart.jsx";
import { useState } from "react";

const AVAILABLE_STOCKS = ['GOOGL', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NFLX', 'NVDA', 'BABA', 'IBM'];

function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('GOOGL');

  return (
    <>
      <Header />

      <div style={{ padding: '20px', textAlign: 'center', background: '#131316' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold', color: '#ffffff' }}>Select Stock: </label>
        <select 
            value={selectedSymbol} 
            onChange={(e) => setSelectedSymbol(e.target.value)}
            style={{ padding: '5px', fontSize: '16px' }}
        >
            {AVAILABLE_STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <StockInfo symbol={selectedSymbol} />
      <Order symbol={selectedSymbol} />
      <StockChart symbol={selectedSymbol} />
    </>
  );
}

export default App;
