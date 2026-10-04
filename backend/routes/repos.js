const express = require('express');
const { readDB, writeDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// 2. Lấy danh sách Repositories (Thành viên 1)
router.get('/', verifyToken, (req, res) => {
  const db = readDB();
  const list = db.repositories.filter(r => r.userId === req.user.id || r.userId === 'user_default');
  res.json({ success: true, repositories: list });
});

// 2. Thêm Repository mới cần giám sát
router.post('/', verifyToken, (req, res) => {
  const { owner, name, defaultBranch, language, description, minQualityScore, blockOnCritical } = req.body;
  if (!owner || !name) {
    return res.status(400).json({ success: false, message: 'Owner và Tên Repository là bắt buộc' });
  }

  const db = readDB();
  const cleanOwner = owner.trim();
  const cleanName = name.trim();

  const newRepo = {
    id: 'repo_' + Date.now(),
    userId: req.user.id,
    owner: cleanOwner,
    name: cleanName,
    fullName: `${cleanOwner}/${cleanName}`,
    defaultBranch: defaultBranch || 'main',
    language: language || 'JavaScript / TypeScript',
    description: description || '',
    minQualityScore: parseInt(minQualityScore) || 80,
    blockOnCritical: blockOnCritical !== undefined ? blockOnCritical : true,
    createdAt: new Date().toISOString()
  };

  db.repositories.push(newRepo);
  writeDB(db);

  res.json({ success: true, repository: newRepo, message: 'Đã thêm Repository vào hệ thống giám sát' });
});

// 2. Cập nhật thông tin Repository
router.put('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const { defaultBranch, language, description, minQualityScore, blockOnCritical } = req.body;

  const db = readDB();
  const repo = db.repositories.find(r => r.id === id);
  if (!repo) return res.status(404).json({ success: false, message: 'Không tìm thấy repository' });

  if (defaultBranch) repo.defaultBranch = defaultBranch;
  if (language) repo.language = language;
  if (description !== undefined) repo.description = description;
  if (minQualityScore !== undefined) repo.minQualityScore = parseInt(minQualityScore);
  if (blockOnCritical !== undefined) repo.blockOnCritical = blockOnCritical;

  writeDB(db);
  res.json({ success: true, repository: repo, message: 'Cập nhật Repository thành công' });
});

// 2. Xóa Repository
router.delete('/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const initLen = db.repositories.length;
  db.repositories = db.repositories.filter(r => r.id !== id);

  if (db.repositories.length === initLen) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy repo để xóa' });
  }

  writeDB(db);
  res.json({ success: true, message: 'Đã xóa Repository khỏi hệ thống' });
});

module.exports = router;
