import Header from "./components/header/Header.jsx";
import StockInfo from "./components/stockInfo/StockInfo.jsx";
import Order from "./components/order/Order.jsx";
import StockChart from "./components/chart/StockChart.jsx";

function App() {

  return (
    <>
      <Header />
      <StockInfo />
      <Order />
      <StockChart />
    </>
  );
}

export default App;
