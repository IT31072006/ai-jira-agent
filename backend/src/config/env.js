const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  // Server configuration
  PORT: parseInt(process.env.PORT || '5000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Database configuration (PostgreSQL - Backend only)
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: String(process.env.DB_PASSWORD || ''),
  DB_NAME: process.env.DB_NAME || 'ai_jira_agent',

  // Authentication & Security
  JWT_SECRET: process.env.JWT_SECRET || 'ai_jira_agent_default_secret_key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

  // n8n Webhook Integration
  N8N_BASE_URL: process.env.N8N_BASE_URL || 'http://localhost:5678',
  N8N_AUTH_WEBHOOK_URL: process.env.N8N_AUTH_WEBHOOK_URL || '',
  N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET || '',

  // Email Configuration
  EMAIL_FROM: process.env.EMAIL_FROM || '"AI Jira Agent" <no-reply@ai-jira-agent.local>',

  // Other n8n Webhooks
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/ai-requirement',
  N8N_JIRA_WEBHOOK_URL: process.env.N8N_JIRA_WEBHOOK_URL || 'http://localhost:5678/webhook-test/push-to-jira',
  N8N_NOTIFICATION_WEBHOOK_URL: process.env.N8N_NOTIFICATION_WEBHOOK_URL || 'http://localhost:5678/webhook-test/epic-created-notification',
  NOTIFICATION_WEBHOOK_SECRET: process.env.NOTIFICATION_WEBHOOK_SECRET || '',

  // Luồng 2: Workspace Management Webhook
  N8N_WORKSPACE_WEBHOOK_URL: process.env.N8N_WORKSPACE_WEBHOOK_URL || 'http://localhost:5678/webhook/workspace-management',
};

module.exports = env;
