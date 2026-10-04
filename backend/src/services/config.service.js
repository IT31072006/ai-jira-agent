const ConfigModel = require('../models/config.model');
const CryptoService = require('./crypto.service');

class ConfigService {
  static validateDomain(domain) {
    if (!domain || typeof domain !== 'string') return null;
    const trimmed = domain.trim();
    if (!trimmed) return null;

    // Cho phép https://company.atlassian.net hoặc company.atlassian.net hoặc http/https URLs
    try {
      const urlToTest = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      const parsed = new URL(urlToTest);
      if (!parsed.hostname || parsed.hostname.length < 3) {
        throw new Error('Invalid');
      }
      return urlToTest;
    } catch (e) {
      const error = new Error('Định dạng Jira domain không hợp lệ (ví dụ: https://your-domain.atlassian.net).');
      error.statusCode = 400;
      throw error;
    }
  }

  static validateEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const trimmed = email.trim();
    if (!trimmed) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      const error = new Error('Định dạng Jira email không hợp lệ.');
      error.statusCode = 400;
      throw error;
    }
    return trimmed.toLowerCase();
  }

  static formatMaskedResponse(config) {
    if (!config) {
      return {
        jira_domain: '',
        jira_email: '',
        jira_api_token_configured: false,
        jira_api_token_masked: null,
        gemini_api_key_configured: false,
        gemini_api_key_masked: null,
        updated_at: null,
      };
    }

    let maskedJiraToken = null;
    let isJiraConfigured = false;
    if (config.jira_api_token_encrypted) {
      try {
        const decrypted = CryptoService.decrypt(config.jira_api_token_encrypted);
        maskedJiraToken = CryptoService.mask(decrypted);
        isJiraConfigured = true;
      } catch (e) {
        maskedJiraToken = '********[Encrypted]';
        isJiraConfigured = true;
      }
    }

    let maskedGeminiKey = null;
    let isGeminiConfigured = false;
    if (config.gemini_api_key_encrypted) {
      try {
        const decrypted = CryptoService.decrypt(config.gemini_api_key_encrypted);
        maskedGeminiKey = CryptoService.mask(decrypted);
        isGeminiConfigured = true;
      } catch (e) {
        maskedGeminiKey = '********[Encrypted]';
        isGeminiConfigured = true;
      }
    }

    return {
      jira_domain: config.jira_domain || '',
      jira_email: config.jira_email || '',
      jira_api_token_configured: isJiraConfigured,
      jira_api_token_masked: maskedJiraToken,
      gemini_api_key_configured: isGeminiConfigured,
      gemini_api_key_masked: maskedGeminiKey,
      updated_at: config.updated_at,
    };
  }

  static async getConfig(userId) {
    const config = await ConfigModel.findByUserId(userId);
    return this.formatMaskedResponse(config);
  }

  static async saveConfig(userId, payload = {}) {
    const existing = await ConfigModel.findByUserId(userId);

    // 1. Jira Domain & Email
    let jiraDomain = existing ? existing.jira_domain : null;
    if (payload.jira_domain !== undefined) {
      jiraDomain = this.validateDomain(payload.jira_domain);
    }

    let jiraEmail = existing ? existing.jira_email : null;
    if (payload.jira_email !== undefined) {
      jiraEmail = this.validateEmail(payload.jira_email);
    }

    // 2. Jira Token Handling
    let jiraApiTokenEncrypted = existing ? existing.jira_api_token_encrypted : null;
    if (payload.remove_jira === true) {
      jiraDomain = null;
      jiraEmail = null;
      jiraApiTokenEncrypted = null;
    } else if (payload.jira_api_token && typeof payload.jira_api_token === 'string' && payload.jira_api_token.trim().length > 0) {
      // Có giá trị mới -> Mã hóa và lưu
      jiraApiTokenEncrypted = CryptoService.encrypt(payload.jira_api_token.trim());
    }
    // Nếu để trống -> Giữ nguyên jiraApiTokenEncrypted hiện tại

    // 3. Gemini Key Handling
    let geminiApiKeyEncrypted = existing ? existing.gemini_api_key_encrypted : null;
    if (payload.remove_gemini === true) {
      geminiApiKeyEncrypted = null;
    } else if (payload.gemini_api_key && typeof payload.gemini_api_key === 'string' && payload.gemini_api_key.trim().length > 0) {
      // Có giá trị mới -> Mã hóa và lưu
      geminiApiKeyEncrypted = CryptoService.encrypt(payload.gemini_api_key.trim());
    }
    // Nếu để trống -> Giữ nguyên geminiApiKeyEncrypted hiện tại

    const saved = await ConfigModel.upsert(userId, {
      jiraDomain,
      jiraEmail,
      jiraApiTokenEncrypted,
      geminiApiKeyEncrypted,
    });

    return this.formatMaskedResponse(saved);
  }

  static async deleteConfig(userId, type) {
    if (type === 'jira') {
      await ConfigModel.clearJiraCredentials(userId);
      return { success: true, message: 'Đã xóa thông tin xác thực Jira thành công.' };
    }

    if (type === 'gemini') {
      await ConfigModel.clearGeminiCredentials(userId);
      return { success: true, message: 'Đã xóa API key Gemini thành công.' };
    }

    await ConfigModel.deleteByUserId(userId);
    return { success: true, message: 'Đã xóa toàn bộ cấu hình tích hợp thành công.' };
  }
}

module.exports = ConfigService;
