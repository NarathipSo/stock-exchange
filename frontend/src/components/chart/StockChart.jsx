import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import './StockChart.css';

import io from 'socket.io-client';
const socket = io(import.meta.env.VITE_API_URL);

const StockChart = () => {
    const chartContainerRef = useRef();
    const lastCandle = useRef(null);

    useEffect(() => {
        const chartOptions = { 
            layout: { 
                textColor: 'black', 
                background: { type: 'solid', color: 'white' } 
            },
            height: 400,
        };
        
        const chart = createChart(chartContainerRef.current, chartOptions);
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });

        // Fetch Data
        fetch(`${import.meta.env.VITE_API_URL}/api/market/history?symbol=GOOGL`)
            .then(res => res.json())
            .then(data => {
                const chartData = data.map(d => ({
                    time: new Date(d.start_time).getTime() / 1000, 
                    open: parseFloat(d.open_price),
                    high: parseFloat(d.high_price),
                    low: parseFloat(d.low_price),
                    close: parseFloat(d.close_price),
                }));
                
                // Sort by time just in case
                chartData.sort((a, b) => a.time - b.time);

                lastCandle.current = chartData[chartData.length - 1];
                
                candlestickSeries.setData(chartData);
            })
            .catch(err => console.error(err));

        chart.timeScale().fitContent();

        socket.on('market_tick', (data) => {
            if (data.symbol === 'GOOGL') {
                const price = parseFloat(data.price);
                const tradeTime = data.timestamp / 1000;
                const candleTime = Math.floor(tradeTime / 60) * 60;
                let open = price;
                let high = price;
                let low = price;
                // Check if we are updating the SAME candle
                if (lastCandle.current && lastCandle.current.time === candleTime) {
                    open = lastCandle.current.open;
                    high = Math.max(lastCandle.current.high, price);
                    low = Math.min(lastCandle.current.low, price);  
                }
                
                const update = {
                    time: candleTime,
                    open: open,
                    high: high,
                    low: low,
                    close: price
                };
                candlestickSeries.update(update);
                lastCandle.current = update;
            }
        });

        return () => {
            chart.remove();
        };
    }, []);

    return (
        <div className="chart-container">
            <h2>Market Chart (GOOGL)</h2>
            <div ref={chartContainerRef} className="chart-window" />
        </div>
    );
};

export default StockChart;