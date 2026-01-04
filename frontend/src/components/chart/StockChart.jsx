import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import './StockChart.css';

import io from 'socket.io-client';
const socket = io(import.meta.env.VITE_API_URL);

const StockChart = ({ symbol }) => {
    const chartContainerRef = useRef();
    const lastCandle = useRef(null);
    const seriesRef = useRef(null); // Keep reference to series

    useEffect(() => {
        const chartOptions = { 
            layout: { textColor: '#a6a6a6', background: { type: 'solid', color: '#0f0f0f' } },
            height: 400,
            grid: {
                vertLines: {
                    visible: false,
                },
                horzLines: {
                    color: '#1c1c1c',   // horizontal grid color
                    style: 0,
                    visible: true,
                },
            },
        };
        const chart = createChart(chartContainerRef.current, chartOptions);
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });
        seriesRef.current = candlestickSeries;

        // Fetch Data
        fetch(`${import.meta.env.VITE_API_URL}/api/market/history?symbol=${symbol}`)
            .then(res => res.json())
            .then(data => {
                const chartData = data.map(d => ({
                    time: new Date(d.start_time).getTime() / 1000, 
                    open: parseFloat(d.open_price),
                    high: parseFloat(d.high_price),
                    low: parseFloat(d.low_price),
                    close: parseFloat(d.close_price),
                })).sort((a, b) => a.time - b.time);

                lastCandle.current = chartData[chartData.length - 1];
                candlestickSeries.setData(chartData);
            })
            .catch(err => console.error(err));

        chart.timeScale().fitContent();
        
        socket.emit('join_stock', symbol);

        const handleConnect = () => {
            console.log("Reconnected, re-joining:", symbol);
            socket.emit('join_stock', symbol);
        };
        socket.on('connect', handleConnect);

        const handleTick = (data) => {
            if (data.symbol === symbol) {
                const price = parseFloat(data.price);
                const tradeTime = data.timestamp / 1000;
                const candleTime = Math.floor(tradeTime / 60) * 60;
                
                let open = price, high = price, low = price;
                
                if (lastCandle.current && lastCandle.current.time === candleTime) {
                    open = lastCandle.current.open;
                    high = Math.max(lastCandle.current.high, price);
                    low = Math.min(lastCandle.current.low, price);  
                }
                
                const update = { time: candleTime, open, high, low, close: price };
                seriesRef.current.update(update);
                lastCandle.current = update;
            }
        };

        socket.on('market_tick', handleTick);

        return () => {
            socket.emit('leave_stock', symbol);
            socket.off('market_tick', handleTick);
            socket.off('connect', handleConnect);
            chart.remove();
        };
    }, [symbol]);

    return (
        <div className="chart-container">
            <h2>Market Chart ({symbol})</h2>
            <div ref={chartContainerRef} className="chart-window" />
        </div>
    );
};

export default StockChart;