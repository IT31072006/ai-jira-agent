CREATE TABLE IF NOT EXISTS jira_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_key VARCHAR(50) NOT NULL UNIQUE,
    issue_id VARCHAR(50),
    project_key VARCHAR(50) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    description TEXT,
    issue_type VARCHAR(50) DEFAULT 'Task',
    status VARCHAR(50) NOT NULL DEFAULT 'To Do',
    status_category VARCHAR(50) DEFAULT 'To Do',
    assignee VARCHAR(150),
    jira_url TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jira_issues_key ON jira_issues(issue_key);
CREATE INDEX IF NOT EXISTS idx_jira_issues_project_key ON jira_issues(project_key);
CREATE INDEX IF NOT EXISTS idx_jira_issues_status ON jira_issues(status);
CREATE INDEX IF NOT EXISTS idx_jira_issues_last_synced ON jira_issues(last_synced_at DESC);
