import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import ProjectModal from '../components/project/ProjectModal';
import RequirementAnalyzer from '../components/ai/RequirementAnalyzer';
import JiraWebhookSyncBoard from '../components/jira/JiraWebhookSyncBoard';
import { projectApi } from '../api/projectApi';
import {
  ArrowLeft,
  FolderGit2,
  Calendar,
  Clock,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  Layers,
} from 'lucide-react';

export const ProjectDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjectDetail = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await projectApi.getProjectById(id);
      setProject(data.project);
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Không tìm thấy dự án hoặc bạn không có quyền truy cập.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetail();
  }, [id]);

  const handleUpdate = async (formData) => {
    setIsSubmitting(true);
    try {
      const data = await projectApi.updateProject(id, formData);
      setProject(data.project);
      setSuccessMsg('Cập nhật thông tin dự án thành công!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa dự án "${project.name}"?\nThao tác này sẽ xóa toàn bộ dữ liệu liên quan!`
    );
    if (!confirmed) return;

    try {
      await projectApi.deleteProject(project.id);
      navigate('/projects', {
        state: { message: `Đã xóa dự án "${project.name}" thành công.` },
      });
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể xóa dự án.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa cập nhật';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="dashboard-content">
        <div className="container">
          {/* Breadcrumb / Back button */}
          <div className="detail-top-nav">
            <Link to="/projects" className="btn-back">
              <ArrowLeft size={16} />
              <span>Quay lại danh sách dự án</span>
            </Link>
          </div>

          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Đang tải thông tin dự án...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error">
              <AlertCircle size={18} className="alert-icon" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {successMsg && (
                <div className="alert alert-success">
                  <CheckCircle2 size={18} className="alert-icon" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Project Header Banner */}
              <div className="project-detail-header">
                <div className="project-header-info">
                  <div className="project-icon-large">
                    <FolderGit2 size={32} />
                  </div>
                  <div>
                    <span className="badge badge-success">Workspace Active</span>
                    <h1 className="project-title-large">{project.name}</h1>
                    <p className="project-id-text">
                      Project ID: <code>{project.id}</code>
                    </p>
                  </div>
                </div>

                <div className="detail-action-buttons">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-outline"
                    id="edit-project-detail-btn"
                  >
                    <Edit size={16} />
                    <span>Chỉnh sửa</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn btn-outline btn-logout"
                    id="delete-project-detail-btn"
                  >
                    <Trash2 size={16} />
                    <span>Xóa dự án</span>
                  </button>
                </div>
              </div>

              {/* Main Grid: Description & Metadata */}
              <div className="grid-2-col">
                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <FileText className="card-icon text-primary" size={20} />
                      <h3>Mô tả dự án</h3>
                    </div>
                  </div>
                  <div className="card-body">
                    <p className="project-detail-description">
                      {project.description ||
                        'Chưa có mô tả cụ thể cho dự án này. Bấm vào nút "Chỉnh sửa" để cập nhật thông tin chi tiết.'}
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <Clock className="card-icon text-accent" size={20} />
                      <h3>Thời gian & Thông tin hệ thống</h3>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="profile-item">
                      <span className="profile-label">Ngày khởi tạo</span>
                      <span className="profile-value font-medium">
                        {formatDate(project.created_at)}
                      </span>
                    </div>
                    <div className="profile-item">
                      <span className="profile-label">Cập nhật lần cuối</span>
                      <span className="profile-value font-medium">
                        {formatDate(project.updated_at)}
                      </span>
                    </div>
                    <div className="profile-item">
                      <span className="profile-label">Quyền sở hữu</span>
                      <span className="badge badge-success">Chủ sở hữu (Owner)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Flow 5 AI Requirement Analyzer & Flow 7 Jira Integration */}
              <RequirementAnalyzer project={project} />

              {/* Flow 9 Jira Webhook Sync Board */}
              <JiraWebhookSyncBoard project={project} />
            </>
          )}
        </div>
      </main>

      {/* Modal Edit */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleUpdate}
        initialData={project}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ProjectDetailPage;
