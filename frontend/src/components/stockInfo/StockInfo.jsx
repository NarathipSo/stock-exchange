import "./StockInfo.css";
import { useState, useEffect } from "react";
import io from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

const StockInfo = () => {
  const [orderBook, setOrderBook] = useState({ bids: [], offers: [], currentPrice: [{price: 0}] });

  const fetchOrderBook = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orderbook/GOOGL`);
      const data = await res.json();

      if (data) {
        setOrderBook(data);
      }

    } catch (error) {
      console.error("Failed to fetch order book", error);
    }
  };

  useEffect(() => {
    fetchOrderBook();

    // Listen for "orderbook_update" event from Server
    socket.on('orderbook_update', (data) => {
        console.log("Real-time update received!");
        if (data && data.bids && data.offers) {
            setOrderBook(data);
        }
    });

    // Cleanup listener on unmount
    return () => {
        socket.off('orderbook_update');
    };
  }, []);

  return (
    <div className="container">
      <h1 className="stock"><span>{orderBook.currentPrice?.[0]?.price ?? 0}</span> &nbsp; GOOGL</h1>

      <div className="market-container">
        <div className="market-window">
          <h2>Bids</h2>
          <table className="prices">
            <thead>
              <tr>
                <th>Price</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {orderBook.bids.map((order, i) => (
                <tr key={i} className='bid-row'>
                  <td>{order.price}</td>
                  <td className='qty-row'>{order.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="market-window">
          <h2>Offers</h2>
          <table className="prices">
            <thead>
              <tr>
                <th>Price</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {orderBook.offers.map((order, i) => (
                <tr key={i} className='offer-row'>
                  <td>{order.price}</td>
                  <td className='qty-row'>{order.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockInfo;
