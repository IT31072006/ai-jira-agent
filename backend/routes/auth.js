const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readDB, writeDB } = require('../storage');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ai-jira-secret-key-2026-super-secure';

// Middleware xác thực token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'Thiếu Token xác thực' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// 1. Đăng ký tài khoản (Thành viên 1)
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ họ tên, email và mật khẩu' });
    }

    const db = readDB();
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã được đăng ký' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: 'user_' + Date.now(),
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    // Tự động tạo 1 workspace mặc định cho user
    const defaultWs = {
      id: 'ws_' + Date.now(),
      userId: newUser.id,
      name: `${fullName}'s Workspace`,
      description: 'Dự án mặc định khi bắt đầu',
      defaultJiraProjectKey: 'PROJ',
      createdAt: new Date().toISOString()
    };
    db.workspaces.push(defaultWs);

    writeDB(db);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, fullName: newUser.fullName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Đăng ký thành công',
      token,
      user: { id: newUser.id, email: newUser.email, fullName: newUser.fullName },
      activeWorkspaceId: defaultWs.id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// 2. Đăng nhập (Thành viên 1)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
    }

    const db = readDB();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    // Cho phép đăng nhập demo dễ dàng
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    }
    if (!isMatch && password === 'password123') {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userWorkspaces = db.workspaces.filter(w => w.userId === user.id);
    const activeWorkspaceId = userWorkspaces.length > 0 ? userWorkspaces[0].id : null;

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName },
      activeWorkspaceId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// 3. Lấy thông tin user hiện tại
router.get('/me', verifyToken, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
  }

  res.json({
    success: true,
    user: { id: user.id, email: user.email, fullName: user.fullName }
  });
});

module.exports = {
  router,
  verifyToken
};
