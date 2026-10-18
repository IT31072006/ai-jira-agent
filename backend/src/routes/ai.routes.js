const express = require('express');
const { analyze, mutate } = require('../controllers/ai.controller');

const router = express.Router();

router.post('/analyze', analyze);
router.post('/mutate-story-task', mutate);

module.exports = router;