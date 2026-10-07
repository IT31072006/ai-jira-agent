const axios = require('axios');

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/ai-requirement';

const analyzeRequirement = async (requirement) => {
  const response = await axios.post(N8N_WEBHOOK_URL, {
    requirement,
  });

  const rawData = response.data;
  if (!rawData) {
    throw new Error('n8n không trả về dữ liệu');
  }

  // Trường hợp n8n trả về trực tiếp object đã có epics
  if (typeof rawData === 'object' && (rawData.epics || rawData.data?.epics)) {
    return rawData;
  }

  // Trường hợp trả về qua parts, content, text hoặc string
  let text =
    rawData?.parts?.[0]?.text ||
    rawData?.content ||
    rawData?.text ||
    (typeof rawData === 'string' ? rawData : null);

  if (!text && typeof rawData === 'object') {
    return rawData;
  }

  if (!text) {
    throw new Error('n8n không trả về nội dung AI hợp lệ');
  }

  // Làm sạch markdown nếu LLM bọc trong ```json ... ```
  if (typeof text === 'string') {
    const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  }

  return text;
};

module.exports = {
  analyzeRequirement,
};