-- Migration 005: Bổ sung liên kết và chỉ mục phục vụ Luồng 10 (Dashboard & Reporting)

-- Thêm trường project_key vào bảng projects để lưu mã Jira Project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_key VARCHAR(50);

-- Thêm liên kết user_id và project_id vào bảng jira_issues để phân quyền dữ liệu chính xác
ALTER TABLE jira_issues ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE jira_issues ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Tạo index tối ưu hóa cho các truy vấn thống kê Dashboard
CREATE INDEX IF NOT EXISTS idx_jira_issues_user_id ON jira_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_jira_issues_project_id ON jira_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_jira_issues_created_at ON jira_issues(created_at);
CREATE INDEX IF NOT EXISTS idx_jira_issues_issue_type ON jira_issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_projects_key ON projects(project_key);
