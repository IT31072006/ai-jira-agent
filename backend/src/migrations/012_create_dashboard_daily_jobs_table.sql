-- Migration 012: Bảng ghi nhận nhật ký các phiên chạy Daily Analytics Scheduler (Dashboard Daily Jobs)
-- Phục vụ Flow 10: Theo dõi trạng thái (running, completed, partial_failed, failed), chống chạy trùng và lưu vết thực thi

CREATE TABLE IF NOT EXISTS dashboard_daily_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    run_id VARCHAR(150) NOT NULL UNIQUE,
    trigger_source VARCHAR(100) NOT NULL DEFAULT 'N8N_FLOW_10_DAILY_SCHEDULE',
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'partial_failed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE,
    projects_total INT NOT NULL DEFAULT 0,
    projects_succeeded INT NOT NULL DEFAULT 0,
    projects_failed INT NOT NULL DEFAULT 0,
    error_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboard_daily_jobs_date ON dashboard_daily_jobs(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_daily_jobs_status ON dashboard_daily_jobs(status);

