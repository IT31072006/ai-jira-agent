const { analyzeRequirement, mutateStoryTask } = require('../services/ai.service');

const analyze = async (req, res, next) => {
  try {
    const { requirement, projectId } = req.body;
    const userId = req.user?.id || 'system-user';

    if (!requirement || !requirement.trim()) {
      return res.status(400).json({
        message: 'Requirement không được để trống',
      });
    }

    const result = await analyzeRequirement(requirement, {
      projectId,
      userId,
      requestId: `req-ai-${Date.now()}`,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const mutate = async (req, res, next) => {
  try {
    const { action, targetType, epics, epicId, storyId, taskId, data } = req.body;
    const userId = req.user?.id || 'system-user';

    if (!action || !targetType || !epics) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu các trường bắt buộc: action, targetType, epics',
      });
    }

    const result = await mutateStoryTask(
      action,
      targetType,
      epics,
      { epicId, storyId, taskId, data },
      { userId, requestId: `req-mut-${Date.now()}` }
    );

    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  analyze,
  mutate,
};