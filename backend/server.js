import express from 'express';
import cors from 'cors';
import { db } from './db.js'

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

//monthly sales
// monthly sales with optional filters
app.get('/api/sales/monthly', (req, res) => {
  try {
    const { region, category, start, end } = req.query;

    const rows = db.prepare(`
      SELECT 
        strftime('%Y-%m', order_date) AS month,
        ROUND(SUM(sales), 2) AS total_sales,
        ROUND(SUM(profit), 2) AS total_profit
      FROM sales
      WHERE order_date IS NOT NULL
        AND (:region IS NULL OR region = :region)
        AND (:category IS NULL OR category = :category)
        AND (:start IS NULL OR order_date >= :start)
        AND (:end IS NULL OR order_date <= :end)
      GROUP BY month
      ORDER BY month;
    `).all({
      region: region || null,
      category: category || null,
      start: start || null,
      end: end || null
    });

    res.json(rows);
  } catch (err) {
    console.error('Error in /api/sales/monthly:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//top categories by sales
// Top categories by sales (with filters)
app.get('/api/sales/top-categories', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '5', 10), 50);
    const { region, start, end } = req.query;

    const rows = db.prepare(`
      SELECT category,
             ROUND(SUM(sales),2) AS total_sales,
             ROUND(SUM(profit),2) AS total_profit
      FROM sales
      WHERE 1=1
        AND (:region IS NULL OR region = :region)
        AND (:start IS NULL OR order_date >= :start)
        AND (:end IS NULL OR order_date <= :end)
      GROUP BY category
      ORDER BY total_sales DESC
      LIMIT :limit
    `).all({
      region: region || null,
      start: start || null,
      end: end || null,
      limit
    });

    res.json(rows);
  } catch (err) {
    console.error('Error in /api/sales/top-categories:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Region-wise sales (with filters)
app.get('/api/sales/regions', (req, res) => {
  try {
    const { category, start, end } = req.query;

    const rows = db.prepare(`
      SELECT region,
             ROUND(SUM(sales),2) AS total_sales
      FROM sales
      WHERE 1=1
        AND (:category IS NULL OR category = :category)
        AND (:start IS NULL OR order_date >= :start)
        AND (:end IS NULL OR order_date <= :end)
      GROUP BY region
      ORDER BY total_sales DESC
    `).all({
      category: category || null,
      start: start || null,
      end: end || null
    });

    res.json(rows);
  } catch (err) {
    console.error('Error in /api/sales/regions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Linear regression forecast (with filters)
app.post('/api/sales/predict', (req, res) => {
  try {
    const { category, region, start, end } = req.query;

    const monthly = db.prepare(`
      SELECT substr(order_date,1,7) as month,
             SUM(sales) as revenue
      FROM sales
      WHERE order_date IS NOT NULL
        AND (:category IS NULL OR category = :category)
        AND (:region IS NULL OR region = :region)
        AND (:start IS NULL OR order_date >= :start)
        AND (:end IS NULL OR order_date <= :end)
      GROUP BY month
      ORDER BY month
    `).all({
      category: category || null,
      region: region || null,
      start: start || null,
      end: end || null
    });

    if (!monthly || monthly.length === 0) {
      return res.json({ next_month_forecast: 0, points_used: 0 });
    }

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

    res.json({
      next_month_forecast: Math.round(forecast*100)/100,
      points_used: n,
      slope: Math.round(m*10000)/10000
    });

  } catch (err) {
    console.error('Error in /api/sales/predict:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));