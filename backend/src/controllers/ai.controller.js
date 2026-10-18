const { analyzeRequirement } = require('../services/ai.service');

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

module.exports = {
  analyze,
};