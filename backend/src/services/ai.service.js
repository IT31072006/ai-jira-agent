const axios = require('axios');

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/ai-requirement';

const analyzeRequirement = async (requirement) => {
  const response = await axios.post(N8N_WEBHOOK_URL, {
    requirement,
  });

  const text = response.data?.parts?.[0]?.text;

  if (!text) {
    throw new Error('n8n không trả về nội dung AI hợp lệ');
  }

  return JSON.parse(text);
};

module.exports = {
  analyzeRequirement,
};