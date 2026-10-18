const ProjectService = require('../services/project.service');
const WorkspaceEventService = require('../services/workspace-event.service');

class ProjectController {
  static async getAll(req, res, next) {
    try {
      const userId = req.user.id;
      const projects = await ProjectService.getProjects(userId);

      // Kích hoạt sự kiện WORKSPACE_VIEWED sang n8n Flow 2 (asynchronous / non-blocking)
      WorkspaceEventService.emitEvent({
        eventType: 'WORKSPACE_VIEWED',
        userId,
        workspaceId: null,
        workspaceName: 'All Workspaces',
        metadata: { totalProjects: projects.length },
      }).catch(() => {});

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

      // Kích hoạt sự kiện WORKSPACE_VIEWED sang n8n Flow 2
      WorkspaceEventService.emitEvent({
        eventType: 'WORKSPACE_VIEWED',
        userId,
        workspaceId: project.id,
        workspaceName: project.name,
        description: project.description,
      }).catch(() => {});

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

      // Kích hoạt sự kiện WORKSPACE_CREATED sang n8n Flow 2 sau khi lưu PostgreSQL thành công
      let workflowEvent = undefined;
      try {
        const wfRes = await WorkspaceEventService.emitEvent({
          eventType: 'WORKSPACE_CREATED',
          userId,
          workspaceId: project.id,
          workspaceName: project.name,
          description: project.description,
          metadata: { projectKey: project.project_key },
        });
        if (wfRes.dispatched) {
          workflowEvent = wfRes.responseData;
        }
      } catch (err) {
        console.warn('[ProjectController] Bỏ qua lỗi n8n khi tạo workspace:', err.message);
      }

      return res.status(201).json({
        message: 'Tạo dự án thành công.',
        project,
        ...(workflowEvent ? { workflowEvent } : {}),
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description, projectKey, project_key } = req.body;

      const project = await ProjectService.updateProject(id, userId, {
        name,
        description,
        projectKey: projectKey || project_key,
      });

      // Kích hoạt sự kiện WORKSPACE_UPDATED sang n8n Flow 2
      let workflowEvent = undefined;
      try {
        const wfRes = await WorkspaceEventService.emitEvent({
          eventType: 'WORKSPACE_UPDATED',
          userId,
          workspaceId: project.id,
          workspaceName: project.name,
          description: project.description,
          metadata: { projectKey: project.project_key },
        });
        if (wfRes.dispatched) {
          workflowEvent = wfRes.responseData;
        }
      } catch (err) {
        console.warn('[ProjectController] Bỏ qua lỗi n8n khi cập nhật workspace:', err.message);
      }

      return res.status(200).json({
        message: 'Cập nhật dự án thành công.',
        project,
        ...(workflowEvent ? { workflowEvent } : {}),
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

      // Kích hoạt sự kiện WORKSPACE_DELETED sang n8n Flow 2
      let workflowEvent = undefined;
      try {
        const wfRes = await WorkspaceEventService.emitEvent({
          eventType: 'WORKSPACE_DELETED',
          userId,
          workspaceId: id,
        });
        if (wfRes.dispatched) {
          workflowEvent = wfRes.responseData;
        }
      } catch (err) {
        console.warn('[ProjectController] Bỏ qua lỗi n8n khi xóa workspace:', err.message);
      }

      return res.status(200).json({
        message: result.message,
        ...(workflowEvent ? { workflowEvent } : {}),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProjectController;
