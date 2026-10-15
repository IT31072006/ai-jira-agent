const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Không tìm thấy Bearer token xác thực.',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token xác thực không hợp lệ.',
      });
    }

    const secret = process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        });
      }
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token không hợp lệ.',
      });
    }

    if (!decoded.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Payload token không hợp lệ.',
      });
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Người dùng không tồn tại hoặc đã bị xóa.',
      });
    }

    // Attach user information to req.user (without password_hash)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
