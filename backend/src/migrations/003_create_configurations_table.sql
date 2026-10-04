CREATE TABLE IF NOT EXISTS configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    jira_domain VARCHAR(255),
    jira_email VARCHAR(255),
    jira_api_token_encrypted TEXT,
    gemini_api_key_encrypted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_configurations_user_id ON configurations(user_id);
