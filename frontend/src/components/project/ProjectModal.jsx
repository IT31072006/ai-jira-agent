import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit3, AlertCircle } from 'lucide-react';

export const ProjectModal = ({ isOpen, onClose, onSubmit, initialData = null, isSubmitting = false }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tên dự án không được để trống.');
      return;
    }

    if (trimmedName.length > 150) {
      setError('Tên dự án không được vượt quá 150 ký tự.');
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim() || '',
      });
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi lưu dự án.';
      setError(msg);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              {isEdit ? <Edit3 size={18} /> : <FolderPlus size={18} />}
            </div>
            <h3>{isEdit ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error modal-alert">
            <AlertCircle size={16} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="project-name">
              Tên dự án <span className="text-danger">*</span>
            </label>
            <input
              id="project-name"
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ví dụ: Restaurant Booking App, E-commerce Website..."
              disabled={isSubmitting}
              autoFocus
              required
            />
            <span className="form-hint">Tối đa 150 ký tự</span>
          </div>

          <div className="form-group">
            <label htmlFor="project-desc">Mô tả dự án</label>
            <textarea
              id="project-desc"
              className="form-control textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả mục tiêu, đối tượng sử dụng hoặc bối cảnh của phần mềm..."
              disabled={isSubmitting}
            />
            <span className="form-hint">Tùy chọn, tối đa 2000 ký tự</span>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              id="project-submit-btn"
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner"></span>
                  <span>Đang lưu...</span>
                </span>
              ) : (
                <span>{isEdit ? 'Cập nhật dự án' : 'Tạo dự án'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
