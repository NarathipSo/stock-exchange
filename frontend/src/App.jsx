import Header from "./components/header/Header.jsx";
import StockInfo from "./components/stockInfo/StockInfo.jsx";
import Order from "./components/order/Order.jsx";
import { useState, useEffect } from "react";
import io from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

function App() {
  const [orderBook, setOrderBook] = useState({ bids: [], offers: [], currentPrice: [{price: 0}] });

  const fetchOrderBook = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orderbook/GOOGL`);
      const data = await res.json();

      setOrderBook(data);
    } catch (error) {
      console.error("Failed to fetch order book", error);
    }
  };

  useEffect(() => {
    fetchOrderBook();

    // Listen for "orderbook_update" event from Server
    socket.on('orderbook_update', () => {
        console.log("Real-time update received!");
        fetchOrderBook();
    });

    // Cleanup listener on unmount
    return () => {
        socket.off('orderbook_update');
    };
  }, []);

  return (
    <>
      <Header />
      <StockInfo orderBook={orderBook} />
      <Order refresh={fetchOrderBook} />
    </>
  );
}

export default App;
