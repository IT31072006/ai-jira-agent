-- Migration 006: Tạo bảng notification_events và cấu hình thông báo Luồng 11

-- 1. Bổ sung các trường cấu hình thông báo vào bảng configurations
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(50) DEFAULT 'discord';
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;
ALTER TABLE configurations ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

-- 2. Tạo bảng notification_events để lưu vết sự kiện và đảm bảo tính Idempotency
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL DEFAULT 'jira.epic.created',
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    project_key VARCHAR(50) NOT NULL,
    epic_key VARCHAR(50) NOT NULL,
    epic_summary VARCHAR(500),
    channel VARCHAR(50) NOT NULL DEFAULT 'discord',
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    payload JSONB NOT NULL,
    response_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_events_event_id ON notification_events(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_user_id ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_status ON notification_events(status);
CREATE INDEX IF NOT EXISTS idx_notification_events_epic_key ON notification_events(epic_key);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON notification_events(created_at DESC);
