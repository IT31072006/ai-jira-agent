const crypto = require('crypto');

class CryptoService {
  static getKey() {
    const rawKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'ai_jira_agent_default_secret_encryption_key_32';
    // Đảm bảo chính xác 32 bytes (256 bits) cho AES-256
    return crypto.createHash('sha256').update(String(rawKey)).digest();
  }

  /**
   * Mã hóa văn bản bí mật bằng AES-256-GCM
   * @param {string} text - Plaintext secret
   * @returns {string|null} - "ivHex:authTagHex:encryptedHex"
   */
  static encrypt(text) {
    if (text === null || text === undefined || text === '') {
      return null;
    }
    const key = this.getKey();
    const iv = crypto.randomBytes(12); // Chuẩn 12 bytes IV cho GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Giải mã ciphertext AES-256-GCM
   * @param {string} encryptedPayload - "ivHex:authTagHex:encryptedHex"
   * @returns {string|null} - Plaintext secret
   */
  static decrypt(encryptedPayload) {
    if (!encryptedPayload || typeof encryptedPayload !== 'string') {
      return null;
    }
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Dữ liệu mã hóa không đúng định dạng.');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Mặt nạ hóa secret để trả về Frontend an toàn (vd: ********abcd)
   * @param {string} secret 
   * @param {number} visibleChars 
   * @returns {string|null}
   */
  static mask(secret, visibleChars = 4) {
    if (!secret || typeof secret !== 'string') {
      return null;
    }
    const trimmed = secret.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length <= visibleChars) {
      return '********';
    }
    return '********' + trimmed.slice(-visibleChars);
  }
}

module.exports = CryptoService;
