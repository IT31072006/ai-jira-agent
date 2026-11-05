const DailyAnalyticsService = require('./daily-analytics.service');

class DailyAnalyticsSchedulerService {
  static intervalId = null;
  static lastExecutedDate = null;

  /**
   * Khởi động bộ lập lịch thống kê tự động hằng ngày tại Backend
   * Chu kỳ kiểm tra mỗi 60 giây, tự động kích hoạt vào lúc 08:00 Asia/Ho_Chi_Minh
   */
  static start() {
    if (this.intervalId) return;

    console.log('⏰ [DailyAnalyticsScheduler] Bộ lập lịch Daily Project Analytics (Flow 10 Engine) đã khởi động (mục tiêu: 08:00 Asia/Ho_Chi_Minh).');

    // Chạy kiểm tra sau 8 giây khởi động
    setTimeout(() => {
      this.checkAndExecute().catch((err) => {
        console.warn('[DailyAnalyticsScheduler] Lỗi kiểm tra khởi động ban đầu:', err.message);
      });
    }, 8000);

    this.intervalId = setInterval(() => {
      this.checkAndExecute().catch((err) => {
        console.warn('[DailyAnalyticsScheduler] Lỗi trong chu kỳ kiểm tra lịch thống kê:', err.message);
      });
    }, 60000);

    if (this.intervalId && this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏰ [DailyAnalyticsScheduler] Đã dừng bộ lập lịch Daily Project Analytics.');
    }
  }

  static async checkAndExecute() {
    try {
      const now = new Date();
      const timezone = 'Asia/Ho_Chi_Minh';

      // 1. Lấy giờ:phút hiện tại theo Asia/Ho_Chi_Minh
      const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const currentTime = timeFormatter.format(now); // "HH:mm"

      // 2. Lấy ngày YYYY-MM-DD hiện tại theo Asia/Ho_Chi_Minh
      const todayDate = DailyAnalyticsService.getVietnamDate(now);

      // Nếu đã thực thi cho ngày hôm nay, bỏ qua
      if (this.lastExecutedDate === todayDate) {
        return;
      }

      // Kiểm tra xem có đúng 08:00 không
      if (currentTime === '08:00') {
        console.log(`⏰ [DailyAnalyticsScheduler] Đúng 08:00 (${timezone}) ngày ${todayDate}! Tự động kích hoạt Daily Project Analytics...`);
        this.lastExecutedDate = todayDate;

        await DailyAnalyticsService.runDailyAnalytics({
          triggerSource: 'BACKEND_INPROCESS_CRON_0800',
          timezone,
          forceRefresh: false, // Chống ghi đè nếu n8n Scheduler đã thực thi trước
        });
      }
    } catch (error) {
      console.error('[DailyAnalyticsScheduler] Lỗi khi thực thi lịch thống kê:', error.message);
    }
  }
}

module.exports = DailyAnalyticsSchedulerService;

