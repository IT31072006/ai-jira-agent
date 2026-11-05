-- Migration 011: Bảng lưu trữ Snapshot thống kê dự án hàng ngày và theo dõi biến động tiến độ (Daily Project Analytics Snapshots & Fluctuation Tracking)
-- Phục vụ Flow 10: Chế độ B - Scheduled Daily Analytics (08:00 Asia/Ho_Chi_Minh)

CREATE TABLE IF NOT EXISTS project_analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL, -- Ngày thống kê chuẩn YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Thời điểm tính toán chính xác
    total_issues INT NOT NULL DEFAULT 0,
    to_do_issues INT NOT NULL DEFAULT 0,
    in_progress_issues INT NOT NULL DEFAULT 0,
    done_issues INT NOT NULL DEFAULT 0,
    completion_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    story_points NUMERIC(10, 2), -- Dữ liệu Story Points xác thực (NULL nếu chưa có dữ liệu)
    completed_story_points NUMERIC(10, 2), -- Story Points hoàn thành xác thực (NULL nếu chưa có dữ liệu)
    execution_status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'PARTIAL'
    job_id VARCHAR(100) NOT NULL, -- Định danh Job / Request ID thực thi
    summary_data JSONB DEFAULT '{}'::jsonb, -- Toàn bộ DTO tổng quan từ Flow 10
    status_distribution JSONB DEFAULT '{}'::jsonb, -- Phân bố trạng thái chi tiết
    breakdown_data JSONB DEFAULT '{}'::jsonb, -- Phân loại Epic, Story, Task
    trend_data JSONB DEFAULT '[]'::jsonb, -- Xu hướng tạo issue
    completion_metrics JSONB DEFAULT '{}'::jsonb, -- Số liệu tính toán chi tiết
    fluctuations JSONB DEFAULT '{}'::jsonb, -- So sánh biến động với snapshot liền kề trước đó
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_analytics_snapshot_date UNIQUE (project_id, snapshot_date)
);

-- Chỉ mục tối ưu hóa truy vấn lịch sử và so sánh snapshot
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_project_id ON project_analytics_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON project_analytics_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_id ON project_analytics_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_status ON project_analytics_snapshots(execution_status);

