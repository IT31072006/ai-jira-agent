-- Migration 010: Schema lưu trữ hồ sơ thành viên và học hỏi kỹ năng thông minh (AI Smart Assignment)
-- Phục vụ tự động gán việc, gom nhóm chống xung đột merge code và học hỏi điểm mạnh qua lịch sử

CREATE TABLE IF NOT EXISTS jira_member_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id VARCHAR(150) NOT NULL,
    project_key VARCHAR(50),
    display_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    avatar_url TEXT,
    primary_strength VARCHAR(150) DEFAULT 'Fullstack Developer',
    skill_tags JSONB DEFAULT '[]'::jsonb,
    strength_scores JSONB DEFAULT '{"frontend": 0, "backend": 0, "auth": 0, "payment": 0, "devops": 0, "testing": 0}'::jsonb,
    total_assigned_tasks INT DEFAULT 0,
    assignment_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_member_user_account UNIQUE (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_jira_member_profiles_user_id ON jira_member_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_jira_member_profiles_account_id ON jira_member_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_jira_member_profiles_project_key ON jira_member_profiles(project_key);

-- Khởi tạo hồ sơ ban đầu cho các thành viên nòng cốt của nhóm (nếu có user trong DB)
DO $$
DECLARE
    r_user RECORD;
BEGIN
    FOR r_user IN SELECT id FROM users LOOP
        -- Thành viên 1: Pham Huynh Quan (Điểm mạnh: Backend, CSDL & API)
        INSERT INTO jira_member_profiles (
            user_id, account_id, project_key, display_name, email, avatar_url,
            primary_strength, skill_tags, strength_scores, total_assigned_tasks
        ) VALUES (
            r_user.id,
            'usr-quan-02',
            'KAN',
            'Phạm Huỳnh Quân',
            'phamhuynhquan310706@gmail.com',
            'https://secure.gravatar.com/avatar/sample-quan?d=identicon',
            'Backend & CSDL API',
            '["Node.js", "Express", "PostgreSQL", "REST API", "Database Design", "Redis", "WebSocket"]'::jsonb,
            '{"frontend": 2, "backend": 12, "auth": 8, "payment": 4, "devops": 5, "testing": 3}'::jsonb,
            12
        ) ON CONFLICT (user_id, account_id) DO UPDATE SET
            primary_strength = EXCLUDED.primary_strength,
            skill_tags = EXCLUDED.skill_tags,
            strength_scores = EXCLUDED.strength_scores;

        -- Thành viên 2: Tran Minh Thang (Điểm mạnh: Frontend & UI/UX)
        INSERT INTO jira_member_profiles (
            user_id, account_id, project_key, display_name, email, avatar_url,
            primary_strength, skill_tags, strength_scores, total_assigned_tasks
        ) VALUES (
            r_user.id,
            'usr-thang-01',
            'KAN',
            'Trần Minh Thắng',
            'tranthang20060903@gmail.com',
            'https://secure.gravatar.com/avatar/sample-thang?d=identicon',
            'Frontend & UI/UX',
            '["React", "CSS", "UI Components", "Responsive Design", "Form Validation", "SVG/Canvas", "State Management"]'::jsonb,
            '{"frontend": 14, "backend": 3, "auth": 3, "payment": 2, "devops": 2, "testing": 4}'::jsonb,
            14
        ) ON CONFLICT (user_id, account_id) DO UPDATE SET
            primary_strength = EXCLUDED.primary_strength,
            skill_tags = EXCLUDED.skill_tags,
            strength_scores = EXCLUDED.strength_scores;

        -- Thành viên 3: Le Gia Bao (Điểm mạnh: DevOps, Tích hợp & Cổng thanh toán)
        INSERT INTO jira_member_profiles (
            user_id, account_id, project_key, display_name, email, avatar_url,
            primary_strength, skill_tags, strength_scores, total_assigned_tasks
        ) VALUES (
            r_user.id,
            'usr-bao-03',
            'KAN',
            'Lê Gia Bảo',
            'giabao.dev@gmail.com',
            'https://secure.gravatar.com/avatar/sample-bao?d=identicon',
            'Thanh toán & DevOps Automation',
            '["Payment Gateway", "MoMo", "ZaloPay", "VNPay", "n8n Automation", "Docker", "Webhooks"]'::jsonb,
            '{"frontend": 2, "backend": 6, "auth": 4, "payment": 10, "devops": 9, "testing": 3}'::jsonb,
            10
        ) ON CONFLICT (user_id, account_id) DO UPDATE SET
            primary_strength = EXCLUDED.primary_strength,
            skill_tags = EXCLUDED.skill_tags,
            strength_scores = EXCLUDED.strength_scores;

        -- Thành viên 4: Nguyen Van Sang (Điểm mạnh: QA & AI Pipeline)
        INSERT INTO jira_member_profiles (
            user_id, account_id, project_key, display_name, email, avatar_url,
            primary_strength, skill_tags, strength_scores, total_assigned_tasks
        ) VALUES (
            r_user.id,
            'usr-sang-04',
            'KAN',
            'Nguyễn Văn Sáng',
            'vansang.ai@gmail.com',
            'https://secure.gravatar.com/avatar/sample-sang?d=identicon',
            'QA & AI Data Processing',
            '["Gemini AI", "Prompt Engineering", "Unit Testing", "E2E Testing", "Data Analysis", "Reporting"]'::jsonb,
            '{"frontend": 3, "backend": 4, "auth": 2, "payment": 2, "devops": 3, "testing": 11}'::jsonb,
            11
        ) ON CONFLICT (user_id, account_id) DO UPDATE SET
            primary_strength = EXCLUDED.primary_strength,
            skill_tags = EXCLUDED.skill_tags,
            strength_scores = EXCLUDED.strength_scores;
    END LOOP;
END $$;
