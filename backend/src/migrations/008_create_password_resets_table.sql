-- Migration: 008_create_password_resets_table.sql
-- Description: Tạo bảng password_resets lưu trữ mã OTP xác nhận quên mật khẩu

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_email_otp ON password_resets(email, otp_code);
CREATE INDEX IF NOT EXISTS idx_password_resets_email_created ON password_resets(email, created_at DESC);
