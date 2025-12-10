import "./StockInfo.css";

const StockInfo = ({ orderBook, lastUpdated }) => {
  return (
    <div className="container">
      <h1 className="stock"><span>{orderBook.currentPrice[0].price}</span> &nbsp; GOOGL</h1>
      <p id="last-updated">Last Updated: {lastUpdated}</p>

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
