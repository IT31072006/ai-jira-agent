const express = require('express');
const cors = require('cors');
const app = express();

// Cho phép Frontend gọi API mà không bị chặn lỗi CORS
app.use(cors());
// Hỗ trợ đọc dữ liệu JSON gửi lên từ web
app.use(express.json());

// API test thử
app.get('/api/test', (req, res) => {
    res.json({ message: 'Backend Express đã sẵn sàng nhận dữ liệu!' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});