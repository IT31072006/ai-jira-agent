const express = require('express');
const authRoutes = require('./auth.routes');
const projectRoutes = require('./project.routes');
const configRoutes = require('./config.routes');

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Backend Express đã sẵn sàng nhận dữ liệu!' });
});

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/config', configRoutes);

module.exports = router;
