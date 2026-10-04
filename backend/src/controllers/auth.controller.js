const AuthService = require('../services/auth.service');

class AuthController {
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.register({ name, email, password });
      return res.status(201).json({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      return res.status(200).json({
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res, next) {
    try {
      return res.status(200).json({
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
