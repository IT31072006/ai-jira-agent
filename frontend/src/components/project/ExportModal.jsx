import React, { useState } from 'react';
import { exportApi, downloadBlob } from '../../api/exportApi';
import {
  Download,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  Sparkles,
  Loader2,
} from 'lucide-react';

export const ExportModal = ({
  isOpen,
  onClose,
  project,
  draftData = null,
}) => {
  const [format, setFormat] = useState('pdf');
  const [source, setSource] = useState(draftData && draftData.length > 0 ? 'draft' : 'jira');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !project) return null;

  const hasDraft = Boolean(draftData && draftData.length > 0);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMsg('');

      const result = await exportApi.exportProject({
        projectId: project.id,
        format,
        source,
        draftData: source === 'draft' ? draftData : null,
      });

      // Tải file về máy
      downloadBlob(result.blob, result.fileName);

      setSuccessMsg(`Đã tải xuống thành công: ${result.fileName}`);
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Export error:', err);
      // Nếu response là blob nhưng chứa JSON error
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          setError(json.message || 'Không thể xuất tài liệu.');
          return;
        } catch (e) {
          // ignore
        }
      }
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể xuất tài liệu. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '580px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-icon" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
            <Download size={22} />
          </div>
          <div>
            <h3 className="modal-title">Xuất tài liệu dự án</h3>
            <p className="modal-subtitle">
              Xuất toàn bộ cây cấu trúc Epic → Story → Task theo chuẩn PDF hoặc Markdown
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem 1.5rem' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={18} className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
              <CheckCircle2 size={18} className="alert-icon" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Chọn định dạng tài liệu */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              1. Chọn định dạng xuất (Format)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => setFormat('pdf')}
                style={{
                  border: format === 'pdf' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: format === 'pdf' ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ color: '#ef4444' }}>
                  <FileText size={28} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>Tài liệu PDF (.pdf)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Hỗ trợ Unicode, phân trang, in ấn</div>
                </div>
              </div>

              <div
                onClick={() => setFormat('markdown')}
                style={{
                  border: format === 'markdown' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: format === 'markdown' ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ color: '#0284c7' }}>
                  <FileCode size={28} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>Markdown (.md)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Cấu trúc Heading, mở bằng VS Code/GitHub</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chọn nguồn dữ liệu */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>
              2. Chọn nguồn dữ liệu (Data Source)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => setSource('jira')}
                style={{
                  border: source === 'jira' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: source === 'jira' ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ color: '#2563eb' }}>
                  <Database size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Jira Issues (PostgreSQL)</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Đã đồng bộ từ Jira Cloud</div>
                </div>
              </div>

              <div
                onClick={() => {
                  if (hasDraft) setSource('draft');
                }}
                style={{
                  border: source === 'draft' ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                  background: source === 'draft' ? 'rgba(139, 92, 246, 0.05)' : hasDraft ? '#ffffff' : '#f8fafc',
                  opacity: hasDraft ? 1 : 0.6,
                  borderRadius: '8px',
                  padding: '0.85rem',
                  cursor: hasDraft ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ color: '#8b5cf6' }}>
                  <Sparkles size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Bản nháp AI hiện tại</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {hasDraft ? `Đang có ${draftData.length} Epic nháp` : 'Chưa có bản nháp trên trang'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hộp tóm tắt thông tin */}
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: '#f1f5f9',
              fontSize: '0.85rem',
              color: '#334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Dự án:</span>
              <span style={{ fontWeight: 600 }}>{project.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Mã dự án (Key):</span>
              <span style={{ fontWeight: 600 }}>{project.project_key || 'KAN'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>File dự kiến:</span>
              <code style={{ color: '#2563eb' }}>
                AI-Jira-Agent-{(project.project_key || 'KAN').toUpperCase()}-{new Date().toISOString().slice(0, 10)}.{format === 'markdown' ? 'md' : 'pdf'}
              </code>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loading}
            id="confirm-export-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spinner-icon" />
                <span>Đang tạo tài liệu...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Tải xuống ngay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
