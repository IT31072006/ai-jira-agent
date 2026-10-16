const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = require('./src/app');
const { pool } = require('./src/config/db');

const PORT = parseInt(process.env.PORT || '5000', 10);

// Test DB connection before listening
pool.connect()
  .then((client) => {
    client.release();
    console.log('✓ Kết nối cơ sở dữ liệu PostgreSQL thành công!');

    const server = app.listen(PORT, () => {
      console.log(`✓ Server Express đang chạy tại http://localhost:${PORT} (PID: ${process.pid})`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`✗ Lỗi khởi động: Cổng ${PORT} đã bị chiếm dụng bởi một tiến trình khác (PID khác)!`);
        console.error(`  Vui lòng kiểm tra tiến trình đang chạy (lệnh: ss -ltnp | grep ':${PORT}' hoặc lsof -i :${PORT})`);
      } else {
        console.error('✗ Lỗi runtime trên HTTP Server:', err.message);
      }
      process.exit(1);
    });

    const shutdown = (signal) => {
      console.log(`\n[Server] Nhận tín hiệu ${signal}, đang đóng kết nối an toàn...`);
      server.close(() => {
        pool.end().then(() => {
          console.log('[Server] Đã giải phóng kết nối PostgreSQL. Tiến trình kết thúc an toàn.');
          process.exit(0);
        });
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((err) => {
    console.error('✗ Lỗi kết nối PostgreSQL:', err.message);
    process.exit(1);
  });