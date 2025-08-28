import express from 'express';
import cors from 'cors';
import { db } from './db.js'

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

//monthly sales
app.get('/api/sales/monthly', (req, res) => {
    const rows = db.prepare(`
        SELECT substr(order_date,1,7) AS month,
            ROUND(SUM(sales),2) AS total_sales,
            ROUND(SUM(profit),2) AS total_profit
        FROM sales 
        WHERE order_date IS NOT NULL
        GROUP BY month
        ORDER BY month
    `).all();
    res.json(rows);
});

//top categories by sales
app.get('/api/sales/top-categories', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '5', 10), 50);
  const rows = db.prepare(`
    SELECT category,
           ROUND(SUM(sales),2) AS total_sales,
           ROUND(SUM(profit),2) AS total_profit
    FROM sales
    GROUP BY category
    ORDER BY total_sales DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});


// Region-wise sales
app.get('/api/sales/regions', (req, res) => {
  const rows = db.prepare(`
    SELECT region, ROUND(SUM(sales),2) AS total_sales
    FROM sales
    GROUP BY region
    ORDER BY total_sales DESC
  `).all();
  res.json(rows);
});

//linear reg
app.post('/api/sales/predict', (req, res) => {
  const monthly = db.prepare(`
    SELECT substr(order_date,1,7) as month, SUM(sales) as revenue
    FROM sales
    WHERE order_date IS NOT NULL
    GROUP BY month
    ORDER BY month
  `).all();

  if (!monthly || monthly.length === 0) return res.json({ next_month_forecast: 0, points_used: 0 });

  // create xs [0,1,2,...] and ys from revenue
  const ys = monthly.map(r => Number(r.revenue));
  const xs = ys.map((_, i) => i);

  // compute linear regression m,b
  const n = xs.length;
  const sumX = xs.reduce((a,b) => a+b, 0);
  const sumY = ys.reduce((a,b) => a+b, 0);
  const sumXX = xs.reduce((a,b) => a + b*b, 0);
  const sumXY = xs.reduce((a,b,i) => a + b*ys[i], 0);
  const denom = n * sumXX - sumX * sumX;
  let m = 0, b = ys[ys.length-1] || 0;
  if (denom !== 0) {
    m = (n * sumXY - sumX * sumY) / denom;
    b = (sumY - m * sumX) / n;
  }
  const nextX = n;
  const forecast = m * nextX + b;

  res.json({ next_month_forecast: Math.round(forecast*100)/100, points_used: n, slope: Math.round(m*10000)/10000 });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));