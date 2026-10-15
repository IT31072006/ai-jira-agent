const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = require('./src/app');
const { pool } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Test DB connection before listening
pool.connect()
  .then((client) => {
    client.release();
    console.log('✓ Kết nối cơ sở dữ liệu PostgreSQL thành công!');
    
    app.listen(PORT, () => {
      console.log(`✓ Server Express đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('✗ Lỗi kết nối PostgreSQL:', err.message);
    process.exit(1);
  });