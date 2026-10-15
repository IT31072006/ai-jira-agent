-- Migration 007: Thêm parent_key vào bảng jira_issues phục vụ Luồng 12 (Export Documentation)
-- Cho phép xây dựng cây phân cấp Epic -> Story -> Task/Sub-task chính xác

ALTER TABLE jira_issues ADD COLUMN IF NOT EXISTS parent_key VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_jira_issues_parent_key ON jira_issues(parent_key);

-- Cập nhật parent_key cho các issue mẫu hiện có nếu chưa được liên kết
UPDATE jira_issues SET parent_key = 'AJA-1' WHERE issue_key IN ('AJA-3', 'AJA-4') AND parent_key IS NULL;
UPDATE jira_issues SET parent_key = 'AJA-2' WHERE issue_key IN ('AJA-5', 'AJA-6') AND parent_key IS NULL;
UPDATE jira_issues SET parent_key = 'AJA-3' WHERE issue_key IN ('AJA-7', 'AJA-8') AND parent_key IS NULL;
UPDATE jira_issues SET parent_key = 'AJA-4' WHERE issue_key IN ('AJA-9', 'AJA-10') AND parent_key IS NULL;
UPDATE jira_issues SET parent_key = 'AJA-5' WHERE issue_key IN ('AJA-11', 'AJA-12') AND parent_key IS NULL;
