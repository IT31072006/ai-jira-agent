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
        throw new Error(
          'n8n không trả về dữ liệu bóc tách yêu cầu. Nguyên nhân: Khóa Google Gemini API Key trong n8n đã hết hạn mức miễn phí (Quota 429: 20 lượt/ngày) hoặc gặp lỗi kết nối AI. Vui lòng cập nhật API Key mới tại n8n Credentials.'
        );
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

  if (
    lastErr &&
    (lastErr.code === 'ECONNREFUSED' ||
      lastErr.message?.includes('ECONNREFUSED') ||
      lastErr.message?.includes('5678'))
  ) {
    const customErr = new Error(
      'Không thể kết nối đến máy chủ tự động hóa n8n (cổng 5678 đang ngoại tuyến). Vui lòng khởi động n8n daemon/container để tiếp tục.'
    );
    customErr.statusCode = 503;
    throw customErr;
  }

  throw lastErr;
};

module.exports = {
  analyzeRequirement,
};