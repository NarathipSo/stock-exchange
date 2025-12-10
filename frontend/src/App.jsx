import Header from "./components/header/Header.jsx";
import StockInfo from "./components/stockInfo/StockInfo.jsx";
import Order from "./components/order/Order.jsx";
import { useState, useEffect } from "react";

function App() {
  const [orderBook, setOrderBook] = useState({ bids: [], offers: [], currentPrice: [{price: 0}] });
  const [lastUpdated, setLastUpdated] = useState();

  const fetchOrderBook = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/orderbook/GOOGL");
      const data = await res.json();

      setOrderBook(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Failed to fetch order book", error);
    }
  };

  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Header />
      <StockInfo orderBook={orderBook} lastUpdated={lastUpdated} />
      <Order refresh={fetchOrderBook} />
    </>
  );
}

export default App;
