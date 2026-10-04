const express = require('express');
const { readDB } = require('../storage');
const { verifyToken } = require('./auth');

const router = express.Router();

// 10. Dashboard Thống kê Chất lượng Code (Thành viên 4)
router.get('/quality-dashboard', verifyToken, (req, res) => {
  const { repoId } = req.query;
  const db = readDB();

  let reviews = db.reviews || [];
  if (repoId) {
    reviews = reviews.filter(r => r.repoId === repoId);
  }

  let totalReviews = reviews.length;
  let totalScore = 0;
  let criticalSecurityCount = 0;
  let warningCount = 0;
  let cleanCodeCount = 0;

  const grades = { A: 0, B: 0, C: 0, D: 0 };
  const statusStats = { APPROVED: 0, CHANGES_REQUESTED: 0, REVIEWING: 0 };
  const authorMap = {};

  reviews.forEach(rev => {
    totalScore += (rev.qualityScore || 0);

    const g = rev.grade || 'B';
    grades[g] = (grades[g] || 0) + 1;

    const st = rev.status || 'REVIEWING';
    statusStats[st] = (statusStats[st] || 0) + 1;

    (rev.issues || []).forEach(iss => {
      if (iss.severity === 'CRITICAL' || iss.type === 'SECURITY') criticalSecurityCount++;
      else if (iss.severity === 'WARNING') warningCount++;
      else cleanCodeCount++;
    });

    // Thống kê tác giả
    const auth = rev.author || 'Developer';
    if (!authorMap[auth]) authorMap[auth] = { name: auth, prs: 0, totalScore: 0, criticals: 0 };
    authorMap[auth].prs++;
    authorMap[auth].totalScore += (rev.qualityScore || 0);
    authorMap[auth].criticals += (rev.issues || []).filter(i => i.severity === 'CRITICAL').length;
  });

  const avgScore = totalReviews > 0 ? Math.round(totalScore / totalReviews) : 85;
  const passRate = totalReviews > 0 ? Math.round((statusStats.APPROVED / totalReviews) * 100) : 100;

  // Bảng xếp hạng Clean Code
  const leaderboard = Object.values(authorMap).map(a => ({
    name: a.name,
    prsCount: a.prs,
    avgScore: Math.round(a.totalScore / a.prs),
    criticals: a.criticals
  })).sort((a, b) => b.avgScore - a.avgScore);

  res.json({
    success: true,
    stats: {
      totalReviews,
      avgScore,
      passRate,
      grades,
      statusStats,
      issueBreakdown: {
        criticalSecurity: criticalSecurityCount,
        warning: warningCount,
        cleanCode: cleanCodeCount
      },
      leaderboard
    }
  });
});

module.exports = router;
