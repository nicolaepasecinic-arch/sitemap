// Delete ALL style guides (cascades to versions, members, invites).
// Run from the backend folder:  node scripts/clear-styleguides.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    const before = await pool.query('SELECT COUNT(*)::int AS n FROM style_guides');
    const del = await pool.query('DELETE FROM style_guides');
    console.log(`Style guides before: ${before.rows[0].n} — deleted: ${del.rowCount}. Versions/members/invites removed via cascade.`);
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
