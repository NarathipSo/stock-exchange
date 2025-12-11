import { useState } from 'react'
import './Order.css'

const Order = ({ refresh }) => {
    const [userId, setUserId] = useState();
    const [stock_symbol, setStockSymbol] = useState();
    const [type, setType] = useState("BUY");
    const [price, setPrice] = useState();
    const [qty, setQty] = useState();
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            user_id: userId,
            stock_symbol: 'GOOGL',
            order_type: type,
            price: parseFloat(price),
            quantity: parseFloat(qty)
            })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error);
            return;
        }
        
        refresh();

        setUserId('');
        setStockSymbol('');
        setType('BUY');
        setPrice('');
        setQty('');
    }
    
    
    return (
        <div className="container">
            <div className="control-panel">
                <h3>Place Order</h3>
                <form onSubmit={handleSubmit}>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                    </select>
                    <input placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)}/>
                    <input placeholder="Qty"  value={qty} onChange={(e) => setQty(e.target.value)}/>
                    <input placeholder="User ID"  value={userId} onChange={(e) => setUserId(e.target.value)}/>
                    <button type="submit">Submit Order</button>
                </form>
            </div>
        </div>
    );
}

export default Order;