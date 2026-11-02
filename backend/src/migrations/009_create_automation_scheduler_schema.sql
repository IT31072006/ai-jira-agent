-- Migration 009: Cấu hình Lịch Báo cáo Tự động và Nhật ký Tự động hóa (Automation Scheduler & Execution Logs)

-- 1. Bổ sung các trường cấu hình Lịch Báo cáo Tự động vào bảng configurations
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS standup_enabled BOOLEAN DEFAULT false;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS standup_time VARCHAR(10) DEFAULT '08:00';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS standup_days VARCHAR(50) DEFAULT 'mon-fri';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS standup_timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS standup_channel VARCHAR(50) DEFAULT 'discord';

-- 2. Tạo bảng automation_execution_logs để theo dõi lịch sử chạy các Workflow n8n
CREATE TABLE IF NOT EXISTS automation_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    workflow_id VARCHAR(100) NOT NULL DEFAULT 'flow-13-daily-standup',
    workflow_name VARCHAR(150) NOT NULL DEFAULT 'AI Jira Agent - Flow 13 Daily Standup & Sprint Watchdog',
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'SCHEDULE', -- 'SCHEDULE', 'MANUAL_TEST'
    status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'WARNING'
    issues_scanned INT NOT NULL DEFAULT 0,
    issues_at_risk INT NOT NULL DEFAULT 0,
    execution_ms INT NOT NULL DEFAULT 0,
    summary TEXT,
    channel VARCHAR(50) NOT NULL DEFAULT 'discord',
    target_destination TEXT,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_user_id ON automation_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_execution_logs(status);
