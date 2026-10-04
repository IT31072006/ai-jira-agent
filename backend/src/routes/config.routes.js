const express = require('express');
const ConfigController = require('../controllers/config.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Tất cả các endpoint cấu hình tích hợp đều yêu cầu xác thực JWT
router.use(authMiddleware);

router.get('/', ConfigController.get);
router.put('/', ConfigController.update);
router.delete('/', ConfigController.delete);

module.exports = router;
