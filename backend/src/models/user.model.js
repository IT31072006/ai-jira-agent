const db = require('../config/db');

class UserModel {
  static async findByEmail(email) {
    const query = `
      SELECT id, name, email, password_hash, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [email.trim()]);
    return rows[0] || null;
  }

  static async findById(id) {
    const query = `
      SELECT id, name, email, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }

  static async create({ name, email, passwordHash }) {
    const query = `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, name, email, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [name.trim(), email.trim().toLowerCase(), passwordHash]);
    return rows[0];
  }
}

module.exports = UserModel;
