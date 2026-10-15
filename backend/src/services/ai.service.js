const axios = require('axios');

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook-test/ai-requirement';

async function postToN8n(url, payload, options = {}) {
  const mergedOptions = {
    timeout: 120000,
    ...options,
  };
  try {
    return await axios.post(url, payload, mergedOptions);
  } catch (err) {
    if (err.response?.status === 404) {
      let fallbackUrl = null;
      if (url.includes('/webhook-test/')) {
        fallbackUrl = url.replace('/webhook-test/', '/webhook/');
      } else if (url.includes('/webhook/')) {
        fallbackUrl = url.replace('/webhook/', '/webhook-test/');
      }
      if (fallbackUrl) {
        console.log(`[AIService] Thử fallback URL n8n: ${fallbackUrl}`);
        return await axios.post(fallbackUrl, payload, mergedOptions);
      }
    }
    throw err;
  }
}

const analyzeRequirement = async (requirement) => {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await postToN8n(N8N_WEBHOOK_URL, {
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
    } catch (err) {
      lastErr = err;
      console.warn(`[AIService] Lần gọi n8n ${attempt} thất bại: ${err.message}`);
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  }

  throw lastErr;
};

module.exports = {
  analyzeRequirement,
};