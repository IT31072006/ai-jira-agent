const express = require('express');
const { readDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// 10. Luồng Thống kê Dashboard (Thành viên 4)
router.get('/dashboard', verifyToken, (req, res) => {
  const { workspaceId } = req.query;
  const db = readDB();

  let requirements = db.requirements || [];
  if (workspaceId) {
    requirements = requirements.filter(r => r.workspaceId === workspaceId);
  }

  let totalEpics = 0;
  let totalStories = 0;
  let totalTasks = 0;
  let totalStoryPoints = 0;
  let totalEstimatedHours = 0;

  const statusCount = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
  const priorityCount = { 'High': 0, 'Medium': 0, 'Low': 0, 'Highest': 0 };
  const epicPointsData = [];

  requirements.forEach(reqItem => {
    if (reqItem.epics) {
      reqItem.epics.forEach(epic => {
        totalEpics++;
        let epicPoints = 0;

        if (epic.stories) {
          epic.stories.forEach(story => {
            totalStories++;
            const points = parseInt(story.storyPoints) || 0;
            totalStoryPoints += points;
            epicPoints += points;

            // Đếm priority
            const p = story.priority || 'Medium';
            priorityCount[p] = (priorityCount[p] || 0) + 1;

            // Đếm status
            const st = story.status || 'To Do';
            statusCount[st] = (statusCount[st] || 0) + 1;

            if (story.tasks) {
              story.tasks.forEach(task => {
                totalTasks++;
                const hours = parseInt(task.estimatedHours) || 0;
                totalEstimatedHours += hours;

                const tStatus = task.status || 'To Do';
                statusCount[tStatus] = (statusCount[tStatus] || 0) + 1;
              });
            }
          });
        }

        epicPointsData.push({
          epicSummary: epic.summary.slice(0, 30),
          jiraKey: epic.jiraKey || 'N/A',
          storyPoints: epicPoints,
          storiesCount: (epic.stories || []).length
        });
      });
    }
  });

  const completionRate = (totalStories + totalTasks) > 0
    ? Math.round((statusCount['Done'] / (totalStories + totalTasks)) * 100)
    : 0;

  res.json({
    success: true,
    stats: {
      totalRequirements: requirements.length,
      totalEpics,
      totalStories,
      totalTasks,
      totalStoryPoints,
      totalEstimatedHours,
      completionRate,
      statusCount,
      priorityCount,
      epicPointsData
    }
  });
});

module.exports = router;
