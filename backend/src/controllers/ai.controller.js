const { analyzeRequirement } = require('../services/ai.service');

const analyze = async (req, res, next) => {
  try {
    const { requirement } = req.body;

    if (!requirement || !requirement.trim()) {
      return res.status(400).json({
        message: 'Requirement không được để trống',
      });
    }

    const result = await analyzeRequirement(requirement);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyze,
};