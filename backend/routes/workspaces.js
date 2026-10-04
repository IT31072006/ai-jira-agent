const express = require('express');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// Lấy tất cả workspace của user (Thành viên 1)
router.get('/', verifyToken, (req, res) => {
  const db = readDB();
  const list = db.workspaces.filter(w => w.userId === req.user.id || w.userId === 'user_default');
  res.json({ success: true, workspaces: list });
});

// Tạo workspace mới (Thành viên 1)
router.post('/', verifyToken, (req, res) => {
  const { name, description, defaultJiraProjectKey } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Tên workspace là bắt buộc' });
  }

  const db = readDB();
  const newWorkspace = {
    id: 'ws_' + Date.now(),
    userId: req.user.id,
    name,
    description: description || '',
    defaultJiraProjectKey: (defaultJiraProjectKey || 'PROJ').toUpperCase(),
    createdAt: new Date().toISOString()
  };

  db.workspaces.push(newWorkspace);
  writeDB(db);

  res.json({ success: true, workspace: newWorkspace });
});

// Cập nhật workspace (Thành viên 1)
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { name, description, defaultJiraProjectKey } = req.body;

  const db = readDB();
  const ws = db.workspaces.find(w => w.id === id);
  if (!ws) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy workspace' });
  }

  if (name) ws.name = name;
  if (description !== undefined) ws.description = description;
  if (defaultJiraProjectKey) ws.defaultJiraProjectKey = defaultJiraProjectKey.toUpperCase();

  writeDB(db);
  res.json({ success: true, workspace: ws });
});

// Xóa workspace (Thành viên 1)
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const db = readDB();

  const initialLen = db.workspaces.length;
  db.workspaces = db.workspaces.filter(w => w.id !== id);

  if (db.workspaces.length === initialLen) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy workspace cần xóa' });
  }

  writeDB(db);
  res.json({ success: true, message: 'Đã xóa workspace thành công' });
});

module.exports = router;
