import axios from "axios";

const BASE = "http://localhost:4000/api/sales";

async function runTests() {
  try {
    console.log("✅ Health check:");
    let res = await axios.get("http://localhost:4000/api/health");
    console.log(res.data);

    console.log("\n📊 Monthly sales:");
    res = await axios.get(`${BASE}/monthly`);
    console.log(res.data.slice(0, 3)); // first 3 rows only

    console.log("\n🏆 Top categories:");
    res = await axios.get(`${BASE}/top-categories?limit=3`);
    console.log(res.data);

    console.log("\n🌍 Region sales:");
    res = await axios.get(`${BASE}/regions`);
    console.log(res.data);

    console.log("\n📈 Forecast (no filters):");
    res = await axios.post(`${BASE}/predict`);
    console.log(res.data);

    console.log("\n📈 Forecast (region=West):");
    res = await axios.post(`${BASE}/predict?region=West`);
    console.log(res.data);

    console.log("\n📈 Forecast (category=Furniture):");
    res = await axios.post(`${BASE}/predict?category=Furniture`);
    console.log(res.data);

    console.log("\n📈 Forecast (region=East, year 2020 only):");
    res = await axios.post(`${BASE}/predict?region=East&start=2020-01-01&end=2020-12-31`);
    console.log(res.data);

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

runTests();
