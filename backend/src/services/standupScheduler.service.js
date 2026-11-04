const db = require('../config/db');
const ConfigModel = require('../models/config.model');
const AutomationService = require('./automation.service');

class StandupSchedulerService {
  static intervalId = null;

  static start() {
    if (this.intervalId) return;

    console.log('⏰ [StandupScheduler] Bộ lập lịch giám sát Daily Standup (Flow 13 Watchdog) đã khởi động (chu kỳ 60s).');

    // Run check 5s after startup to allow DB pool readiness
    setTimeout(() => {
      this.checkAndExecuteStandups().catch((err) => {
        console.warn('[StandupScheduler] Lỗi chu kỳ kiểm tra khởi động:', err.message);
      });
    }, 5000);

    // Schedule check every 60 seconds
    this.intervalId = setInterval(() => {
      this.checkAndExecuteStandups().catch((err) => {
        console.warn('[StandupScheduler] Lỗi trong chu kỳ kiểm tra lịch standup:', err.message);
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
      console.log('⏰ [StandupScheduler] Đã dừng bộ lập lịch giám sát Daily Standup.');
    }
  }

  static async checkAndExecuteStandups() {
    try {
      const activeConfigs = await ConfigModel.findAllActiveStandups();
      if (!Array.isArray(activeConfigs) || activeConfigs.length === 0) {
        return;
      }

      const now = new Date();

      for (const config of activeConfigs) {
        try {
          const tz = config.standup_timezone || 'Asia/Ho_Chi_Minh';

          // 1. Format current hour:minute in user's timezone (HH:mm)
          const timeFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          const currentTime = timeFormatter.format(now); // e.g. "08:00"

          const targetTime = (config.standup_time || '08:00').trim();
          if (currentTime !== targetTime) {
            continue; // Not the scheduled minute
          }

          // 2. Check day of week
          const dayFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            weekday: 'short',
          });
          const dayOfWeek = dayFormatter.format(now).toLowerCase(); // 'mon', 'tue', ...
          const isWeekend = ['sat', 'sun'].includes(dayOfWeek);
          const daysConfig = (config.standup_days || 'mon-fri').toLowerCase();

          if (daysConfig === 'mon-fri' && isWeekend) {
            continue; // Skip weekends for mon-fri schedule
          }

          // 3. Idempotency: Check if already executed in the last 2 hours (prevent duplicate triggers)
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
          const checkLog = await db.query(
            `SELECT id FROM automation_execution_logs 
             WHERE user_id = $1 AND trigger_type = 'SCHEDULE' AND created_at >= $2 LIMIT 1`,
            [config.user_id, twoHoursAgo]
          );

          if (checkLog.rows && checkLog.rows.length > 0) {
            continue; // Already triggered for this schedule window
          }

          console.log(
            `⏰ [StandupScheduler] Đúng ${targetTime} (${tz})! Đang tự động kích hoạt Báo cáo Daily Standup cho user ${config.user_id}...`
          );

          await AutomationService.triggerStandup(config.user_id, {
            isManual: false,
            customChannel: config.standup_channel || 'discord',
          });

          console.log(`✓ [StandupScheduler] Đã tự động gửi Daily Standup thành công cho user ${config.user_id}!`);
        } catch (itemErr) {
          console.warn(`[StandupScheduler] Lỗi khi xử lý standup cho user ${config.user_id}:`, itemErr.message);
        }
      }
    } catch (err) {
      console.warn('[StandupScheduler] Lỗi truy vấn danh sách standup:', err.message);
    }
  }
}

module.exports = StandupSchedulerService;

