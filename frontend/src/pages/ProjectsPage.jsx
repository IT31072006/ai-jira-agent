import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import ProjectModal from '../components/project/ProjectModal';
import { projectApi } from '../api/projectApi';
import {
  FolderGit2,
  FolderPlus,
  ArrowRight,
  Edit,
  Trash2,
  Calendar,
  Search,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await projectApi.getProjects();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách dự án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleOpenCreateModal = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project, e) => {
    e.stopPropagation();
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      if (selectedProject) {
        await projectApi.updateProject(selectedProject.id, formData);
        setSuccessMsg('Cập nhật dự án thành công!');
      } else {
        await projectApi.createProject(formData);
        setSuccessMsg('Tạo dự án mới thành công!');
      }
      await fetchProjects();
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (project, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa dự án "${project.name}"?\nThao tác này không thể hoàn tác!`
    );
    if (!confirmed) return;

    try {
      await projectApi.deleteProject(project.id);
      setSuccessMsg(`Đã xóa dự án "${project.name}" thành công.`);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err?.response?.data?.message || 'Không thể xóa dự án này.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredProjects = projects.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
  });

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="dashboard-content">
        <div className="container">
          {/* Header Action Bar */}
          <div className="projects-header">
            <div>
              <div className="header-subtitle">
                <FolderGit2 size={18} className="text-primary" />
                <span>Không gian làm việc & Quản lý yêu cầu</span>
              </div>
              <h1 className="projects-title">Dự án của bạn</h1>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="btn btn-primary"
              id="create-project-btn"
            >
              <FolderPlus size={18} />
              <span>Tạo dự án mới</span>
            </button>
          </div>

          {/* Alert Messages */}
          {successMsg && (
            <div className="alert alert-success">
              <CheckCircle2 size={18} className="alert-icon" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={18} className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Bar */}
          {projects.length > 0 && (
            <div className="search-bar-wrapper">
              <div className="input-with-icon">
                <Search size={18} className="input-icon" />
                <input
                  type="text"
                  placeholder="Tìm kiếm dự án theo tên hoặc mô tả..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Project List / Grid */}
          {loading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Đang tải danh sách dự án...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-icon-badge">
                <Sparkles size={32} />
              </div>
              <h3>
                {searchQuery ? 'Không tìm thấy dự án phù hợp' : 'Chưa có dự án nào'}
              </h3>
              <p>
                {searchQuery
                  ? 'Vui lòng thử tìm kiếm bằng từ khóa khác.'
                  : 'Bắt đầu bằng cách tạo không gian làm việc đầu tiên để quản lý yêu cầu phần mềm và sinh Jira Epics/Stories.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenCreateModal}
                  className="btn btn-primary"
                  id="empty-create-btn"
                >
                  <FolderPlus size={18} />
                  <span>Tạo dự án đầu tiên</span>
                </button>
              )}
            </div>
          ) : (
            <div className="projects-grid">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="project-card-header">
                    <div className="project-icon-box">
                      <FolderGit2 size={20} />
                    </div>
                    <div className="project-actions">
                      <button
                        className="btn-icon"
                        onClick={(e) => handleOpenEditModal(project, e)}
                        title="Chỉnh sửa dự án"
                        aria-label="Sửa dự án"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={(e) => handleDeleteProject(project, e)}
                        title="Xóa dự án"
                        aria-label="Xóa dự án"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="project-name">{project.name}</h3>

                  <p className="project-desc">
                    {project.description || 'Chưa có mô tả cho dự án này.'}
                  </p>

                  <div className="project-card-footer">
                    <div className="project-date">
                      <Calendar size={14} />
                      <span>{formatDate(project.created_at)}</span>
                    </div>

                    <button
                      className="btn-open-project"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${project.id}`);
                      }}
                    >
                      <span>Mở</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Create/Edit */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={selectedProject}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ProjectsPage;
