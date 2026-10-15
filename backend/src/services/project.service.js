const ProjectModel = require('../models/project.model');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ProjectService {
  static isValidUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
  }

  static validateProjectInput({ name, description }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const error = new Error('Tên dự án không được để trống.');
      error.statusCode = 400;
      throw error;
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 150) {
      const error = new Error('Tên dự án không được vượt quá 150 ký tự.');
      error.statusCode = 400;
      throw error;
    }

    let trimmedDesc = null;
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        const error = new Error('Mô tả dự án phải là chuỗi ký tự.');
        error.statusCode = 400;
        throw error;
      }
      trimmedDesc = description.trim();
      if (trimmedDesc.length > 2000) {
        const error = new Error('Mô tả dự án không được vượt quá 2000 ký tự.');
        error.statusCode = 400;
        throw error;
      }
    }

    return {
      name: trimmedName,
      description: trimmedDesc,
    };
  }

  static async getProjects(userId) {
    return await ProjectModel.findByUserId(userId);
  }

  static async getProjectById(id, userId) {
    if (!this.isValidUUID(id)) {
      const error = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
      error.statusCode = 404;
      throw error;
    }

    const project = await ProjectModel.findByIdAndUserId(id, userId);
    if (!project) {
      const error = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
      error.statusCode = 404;
      throw error;
    }

    return project;
  }

  static async createProject(userId, { name, description }) {
    const validated = this.validateProjectInput({ name, description });
    return await ProjectModel.create({
      userId,
      name: validated.name,
      description: validated.description,
    });
  }

  static async updateProject(id, userId, { name, description }) {
    if (!this.isValidUUID(id)) {
      const error = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
      error.statusCode = 404;
      throw error;
    }

    const validated = this.validateProjectInput({ name, description });

    const updated = await ProjectModel.update(id, userId, {
      name: validated.name,
      description: validated.description,
    });

    if (!updated) {
      const error = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }

  static async deleteProject(id, userId) {
    if (!this.isValidUUID(id)) {
      const error = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
      error.statusCode = 404;
      throw error;
    }

    const deleted = await ProjectModel.delete(id, userId);
    if (!deleted) {
      const error = new Error('Dự án không tồn tại hoặc bạn không có quyền truy cập.');
      error.statusCode = 404;
      throw error;
    }

    return { message: 'Xóa dự án thành công.' };
  }
}

module.exports = ProjectService;
