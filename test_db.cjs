const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT COUNT(*) FROM dim_planogramas').then(res => console.log(res.rows)).catch(console.error).finally(()=>pool.end());
