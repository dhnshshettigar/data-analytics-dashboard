import fs from 'fs';
import csv from 'csv-parser';
import { db } from './db.js';

//path to the csv 
const CSV_FILE = './data/Global_Superstore2.csv';

//normalise dates like "31-08-2020" to "2012-08-31"
function normalizeDate(s) {
    if (!s) return null;
    s = s.trim();
    // yyyy-mm-dd already
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    //dd-mm-yyyy
    let m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    // mm/dd/yyyy or m/d/yyyy
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const mm = m[1].padStart(2, '0');
        const dd = m[2].padStart(2, '0');
        return `${m[3]}-${mm}-${dd}`;
    }
    // fallback date parse
    const d = new Date(s);
    if (!isNaN(d)) {
        const y = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${mm}-${dd}`;
    }
    return null;
}

//clear table (so re-running seed doesn't duplicate)
db.exec('DELETE FROM sales;');

const insert = db.prepare(`
  INSERT INTO sales (
    order_id, order_date, ship_date, ship_mode, customer_id, customer_name,
    segment, country, region, category, sub_category, product_name,
    sales, quantity, discount, profit
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

let count = 0;

fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (row) => {
        // column names in your CSV may have spaces
        const orderDateRaw = row['Order Date'];
        const shipDateRaw = row['Ship Date'];

        const order_date = normalizeDate(orderDateRaw);
        const ship_date = normalizeDate(shipDateRaw);

        const values = [
            row['Order ID'] || null, order_date, ship_date,
            row['Ship Mode'] || null,
            row['Customer ID'] || null,
            row['Customer Name'] || null,
            row['Segment'] || null,
            row['Country'] || null,
            row['Region'] || null,
            row['Category'] || null,
            row['Sub-Category'] || row['Sub_Category'] || null,
            row['Product Name'] || row['Product_Name'] || null,
            parseFloat(row['Sales'] || 0) || 0,
            parseInt(row['Quantity'] || 0, 10) || 0,
            parseFloat(row['Discount'] || 0) || 0,
            parseFloat(row['Profit'] || 0) || 0
        ];

        try{
            insert.run(values);
            count += 1;
        }catch(e){
            console.error('Insert error for row:', e && e.message ? e.message : e);
        }
    })
    .on('end', () => {
        console.log(`Seed complete: ${count} rows inserted.`);
    })
    .on('error', (err) => {
        console.error('CSV parse error:', err);
    });