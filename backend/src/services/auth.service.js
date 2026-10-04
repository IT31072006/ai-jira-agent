const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/user.model');

class AuthService {
  static validateRegistrationInput({ name, email, password }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const error = new Error('Họ và tên không được để trống.');
      error.statusCode = 400;
      throw error;
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      const error = new Error('Email không hợp lệ.');
      error.statusCode = 400;
      throw error;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      const error = new Error('Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      error.statusCode = 400;
      throw error;
    }
  }

  static validateLoginInput({ email, password }) {
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      const error = new Error('Email không được để trống.');
      error.statusCode = 400;
      throw error;
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      const error = new Error('Mật khẩu không được để trống.');
      error.statusCode = 400;
      throw error;
    }
  }

  static generateToken(user) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment variables.');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

    // JWT payload contains ONLY necessary info (userId, email)
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      secret,
      { expiresIn }
    );
  }

  static async register({ name, email, password }) {
    this.validateRegistrationInput({ name, email, password });

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      const error = new Error('Email này đã được đăng ký trong hệ thống.');
      error.statusCode = 409;
      throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await UserModel.create({
      name,
      email,
      passwordHash,
    });

    return {
      message: 'Registration successful',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    };
  }

  static async login({ email, password }) {
    this.validateLoginInput({ email, password });

    const user = await UserModel.findByEmail(email);
    if (!user) {
      const error = new Error('Email hoặc mật khẩu không chính xác.');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Email hoặc mật khẩu không chính xác.');
      error.statusCode = 401;
      throw error;
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      token,
    };
  }
}

module.exports = AuthService;
