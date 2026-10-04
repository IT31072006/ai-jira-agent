import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import { projectApi } from '../api/projectApi';
import {
  User,
  ShieldCheck,
  CheckCircle2,
  Database,
  Layers,
  FolderGit2,
  ArrowRight,
  FolderPlus,
} from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const data = await projectApi.getProjects();
        setProjectCount(data.projects?.length || 0);
      } catch (e) {
        // Silent catch for stats
      }
    };
    fetchCount();
  }, []);

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="dashboard-content">
        <div className="container">
          {/* Welcome Banner */}
          <div className="welcome-banner">
            <div className="welcome-text">
              <span className="badge badge-success">
                <ShieldCheck size={14} />
                <span>JWT Authentication: Hoạt động</span>
              </span>
              <h1>Xin chào, {user?.name}!</h1>
              <p>
                Bạn đã đăng nhập thành công vào hệ thống. Phiên làm việc của bạn được bảo mật an toàn với JWT và cơ sở dữ liệu PostgreSQL.
              </p>
            </div>

            <div className="welcome-action">
              <Link to="/projects" className="btn btn-primary">
                <FolderGit2 size={18} />
                <span>Xem danh sách Dự án</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Flow 2 Workspace Card Banner */}
          <div className="card workspace-hero-card">
            <div className="workspace-hero-content">
              <div className="workspace-hero-icon">
                <FolderGit2 size={28} />
              </div>
              <div>
                <h3>Không gian làm việc (Flow 2: Project Management)</h3>
                <p>
                  Bạn hiện đang có <strong>{projectCount}</strong> dự án được khởi tạo. Mỗi dự án là một workspace độc lập để lưu trữ và phân tích các yêu cầu phần mềm.
                </p>
              </div>
            </div>
            <Link to="/projects" className="btn btn-outline" id="manage-projects-btn">
              <span>Quản lý Projects</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* User Profile Card & System Status */}
          <div className="grid-2-col">
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <User className="card-icon text-primary" size={20} />
                  <h3>Thông tin tài khoản</h3>
                </div>
              </div>
              <div className="card-body">
                <div className="profile-item">
                  <span className="profile-label">ID Người dùng</span>
                  <code className="profile-value font-mono">{user?.id}</code>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Họ và tên</span>
                  <span className="profile-value font-medium">{user?.name}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Địa chỉ Email</span>
                  <span className="profile-value font-medium">{user?.email}</span>
                </div>
                <div className="profile-item">
                  <span className="profile-label">Trạng thái</span>
                  <span className="badge badge-success">
                    <CheckCircle2 size={13} />
                    <span>Đã xác thực</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <Database className="card-icon text-accent" size={20} />
                  <h3>Trạng thái hạ tầng hệ thống</h3>
                </div>
              </div>
              <div className="card-body">
                <ul className="status-checklist">
                  <li className="status-item done">
                    <CheckCircle2 size={16} className="text-success" />
                    <span>Flow 1: Authentication & PostgreSQL <code>users</code> table</span>
                  </li>
                  <li className="status-item done">
                    <CheckCircle2 size={16} className="text-success" />
                    <span>Flow 2: Project/Workspace Management & <code>projects</code> table</span>
                  </li>
                  <li className="status-item done">
                    <CheckCircle2 size={16} className="text-success" />
                    <span>Flow 3: Cấu hình tích hợp (Jira/Gemini) & AES-256 mã hóa <code>configurations</code> table</span>
                  </li>
                  <li className="status-item done">
                    <CheckCircle2 size={16} className="text-success" />
                    <span>Bảo mật tuyệt đối: Masking secrets, không bao giờ lộ credentials trên client</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Next Steps Card */}
          <div className="card next-steps-card">
            <div className="card-header">
              <div className="card-title-group">
                <Layers className="card-icon text-info" size={20} />
                <h3>Tiến độ các luồng của dự án</h3>
              </div>
            </div>
            <div className="card-body">
              <div className="next-steps-grid">
                <div className="step-badge">
                  <span className="step-num">1</span>
                  <span>Đăng ký / Đăng nhập (Hoàn thành)</span>
                </div>
                <div className="step-badge">
                  <span className="step-num">2</span>
                  <span>Quản lý Dự án / Workspace (Hoàn thành)</span>
                </div>
                <div className="step-badge">
                  <span className="step-num">3</span>
                  <span>Cấu hình API & Tích hợp (Hoàn thành)</span>
                </div>
                <div className="step-badge pending">
                  <span className="step-num">4</span>
                  <span>Nhập Requirement & AI Breakdown</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
