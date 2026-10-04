const ProjectService = require('../services/project.service');

class ProjectController {
  static async getAll(req, res, next) {
    try {
      const userId = req.user.id;
      const projects = await ProjectService.getProjects(userId);
      return res.status(200).json({
        projects,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const project = await ProjectService.getProjectById(id, userId);
      return res.status(200).json({
        project,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      // Security: user_id comes strictly from JWT payload in req.user
      const userId = req.user.id;
      const { name, description } = req.body;

      const project = await ProjectService.createProject(userId, { name, description });
      return res.status(201).json({
        message: 'Tạo dự án thành công.',
        project,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description } = req.body;

      const project = await ProjectService.updateProject(id, userId, { name, description });
      return res.status(200).json({
        message: 'Cập nhật dự án thành công.',
        project,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await ProjectService.deleteProject(id, userId);
      return res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProjectController;
