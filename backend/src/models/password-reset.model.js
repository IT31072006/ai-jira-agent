const db = require('../config/db');

class PasswordResetModel {
  /**
   * Tạo bản ghi mã OTP mới cho email, đồng thời đánh dấu các mã OTP trước đó là đã dùng (invalidate)
   */
  static async createOtp({ email, otpCode, expiresAt }) {
    const cleanEmail = email.trim().toLowerCase();

    // Vô hiệu hóa các OTP trước đó của email này chưa được sử dụng
    await db.query(
      `UPDATE password_resets 
       SET used = TRUE 
       WHERE LOWER(email) = LOWER($1) AND used = FALSE;`,
      [cleanEmail]
    );

    // Chèn OTP mới
    const query = `
      INSERT INTO password_resets (email, otp_code, expires_at, used)
      VALUES ($1, $2, $3, FALSE)
      RETURNING id, email, otp_code, expires_at, used, created_at;
    `;
    const { rows } = await db.query(query, [cleanEmail, otpCode, expiresAt]);
    return rows[0];
  }

  /**
   * Tìm mã OTP hợp lệ (chưa dùng và chưa hết hạn)
   */
  static async findValidOtp({ email, otpCode }) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otpCode).trim();

    const query = `
      SELECT id, email, otp_code, expires_at, used, created_at
      FROM password_resets
      WHERE LOWER(email) = LOWER($1)
        AND otp_code = $2
        AND used = FALSE
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [cleanEmail, cleanOtp]);
    return rows[0] || null;
  }

  /**
   * Đánh dấu mã OTP đã được sử dụng thành công
   */
  static async markUsed(id) {
    const query = `
      UPDATE password_resets
      SET used = TRUE
      WHERE id = $1
      RETURNING id, used;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }
}

module.exports = PasswordResetModel;
