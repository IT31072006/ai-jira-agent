const AuthService = require('../services/auth.service');

class AuthController {
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.register({ name, email, password });
      return res.status(201).json({
        message: result.message,
        user: result.user,
        emailConfirmation: result.emailConfirmation,
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

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await AuthService.requestPasswordReset(email);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async verifyOtp(req, res, next) {
    try {
      const { email, otpCode } = req.body;
      const result = await AuthService.verifyOtp({ email, otpCode });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { email, otpCode, newPassword } = req.body;
      const result = await AuthService.resetPassword({ email, otpCode, newPassword });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
