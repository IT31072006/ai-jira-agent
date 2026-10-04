const db = require('../config/db');

class ConfigModel {
  static async findByUserId(userId) {
    const query = `
      SELECT id, user_id, jira_domain, jira_email, jira_api_token_encrypted, gemini_api_key_encrypted, created_at, updated_at
      FROM configurations
      WHERE user_id = $1
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows[0] || null;
  }

  static async upsert(userId, { jiraDomain, jiraEmail, jiraApiTokenEncrypted, geminiApiKeyEncrypted }) {
    const query = `
      INSERT INTO configurations (
        user_id,
        jira_domain,
        jira_email,
        jira_api_token_encrypted,
        gemini_api_key_encrypted,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        jira_domain = EXCLUDED.jira_domain,
        jira_email = EXCLUDED.jira_email,
        jira_api_token_encrypted = EXCLUDED.jira_api_token_encrypted,
        gemini_api_key_encrypted = EXCLUDED.gemini_api_key_encrypted,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, jira_domain, jira_email, jira_api_token_encrypted, gemini_api_key_encrypted, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [
      userId,
      jiraDomain,
      jiraEmail,
      jiraApiTokenEncrypted,
      geminiApiKeyEncrypted,
    ]);
    return rows[0];
  }

  static async clearJiraCredentials(userId) {
    const query = `
      UPDATE configurations
      SET jira_domain = NULL, jira_email = NULL, jira_api_token_encrypted = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING id, user_id, jira_domain, jira_email, jira_api_token_encrypted, gemini_api_key_encrypted, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows[0] || null;
  }

  static async clearGeminiCredentials(userId) {
    const query = `
      UPDATE configurations
      SET gemini_api_key_encrypted = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING id, user_id, jira_domain, jira_email, jira_api_token_encrypted, gemini_api_key_encrypted, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows[0] || null;
  }

  static async deleteByUserId(userId) {
    const query = `
      DELETE FROM configurations
      WHERE user_id = $1
      RETURNING id;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows[0] || null;
  }
}

module.exports = ConfigModel;
