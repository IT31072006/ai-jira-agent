const db = require('../config/db');

class ProjectModel {
  static async findByUserId(userId) {
    const query = `
      SELECT id, user_id, name, description, created_at, updated_at
      FROM projects
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows;
  }

  static async findByIdAndUserId(id, userId) {
    const query = `
      SELECT id, user_id, name, description, created_at, updated_at
      FROM projects
      WHERE id = $1 AND user_id = $2
      LIMIT 1;
    `;
    const { rows } = await db.query(query, [id, userId]);
    return rows[0] || null;
  }

  static async create({ userId, name, description }) {
    const query = `
      INSERT INTO projects (user_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, name, description, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [userId, name, description || null]);
    return rows[0];
  }

  static async update(id, userId, { name, description }) {
    const query = `
      UPDATE projects
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING id, user_id, name, description, created_at, updated_at;
    `;
    const { rows } = await db.query(query, [name, description || null, id, userId]);
    return rows[0] || null;
  }

  static async delete(id, userId) {
    const query = `
      DELETE FROM projects
      WHERE id = $1 AND user_id = $2
      RETURNING id;
    `;
    const { rows } = await db.query(query, [id, userId]);
    return rows[0] || null;
  }
}

module.exports = ProjectModel;
