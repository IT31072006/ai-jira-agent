import { useState } from 'react';
import { exportApi, downloadBlob } from '../../api/exportApi';
import {
  Download,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  Layers,
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
        } catch {
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
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-dialog"
        style={{
          maxWidth: '580px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-header"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              className="modal-header-icon"
              style={{
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Download size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Xuất tài liệu dự án
              </h3>
              <p className="modal-subtitle" style={{ margin: '0.2rem 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                Xuất toàn bộ cây cấu trúc Epic → Story → Task theo chuẩn PDF hoặc Markdown
              </p>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem 1.5rem', backgroundColor: '#ffffff' }}>
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
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>
              1. Chọn định dạng xuất (Format)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => setFormat('pdf')}
                style={{
                  border: format === 'pdf' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: format === 'pdf' ? '#eff6ff' : '#ffffff',
                  borderRadius: '10px',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                  boxShadow: format === 'pdf' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                }}
              >
                <div style={{ color: '#ef4444', flexShrink: 0 }}>
                  <FileText size={26} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Tài liệu PDF (.pdf)</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Hỗ trợ Unicode, phân trang, in ấn</div>
                </div>
              </div>

              <div
                onClick={() => setFormat('markdown')}
                style={{
                  border: format === 'markdown' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: format === 'markdown' ? '#eff6ff' : '#ffffff',
                  borderRadius: '10px',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                  boxShadow: format === 'markdown' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                }}
              >
                <div style={{ color: '#0284c7', flexShrink: 0 }}>
                  <FileCode size={26} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Markdown (.md)</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Cấu trúc Heading, VS Code/GitHub</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chọn nguồn dữ liệu */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>
              2. Chọn nguồn dữ liệu (Data Source)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div
                onClick={() => setSource('jira')}
                style={{
                  border: source === 'jira' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: source === 'jira' ? '#eff6ff' : '#ffffff',
                  borderRadius: '10px',
                  padding: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                  boxShadow: source === 'jira' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                }}
              >
                <div style={{ color: '#2563eb', flexShrink: 0 }}>
                  <Database size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Jira Issues</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Đã đồng bộ từ Jira Cloud</div>
                </div>
              </div>

              <div
                onClick={() => {
                  if (hasDraft) setSource('draft');
                }}
                style={{
                  border: source === 'draft' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: source === 'draft' ? '#eff6ff' : hasDraft ? '#ffffff' : '#f8fafc',
                  opacity: hasDraft ? 1 : 0.6,
                  borderRadius: '10px',
                  padding: '0.9rem',
                  cursor: hasDraft ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease',
                  boxShadow: source === 'draft' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
                }}
              >
                <div style={{ color: '#0052cc', flexShrink: 0 }}>
                  <Layers size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>Bản nháp AI hiện tại</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    {hasDraft ? `Đang có ${draftData.length} Epic nháp` : 'Chưa có bản nháp trên trang'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hộp tóm tắt thông tin */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '0.85rem',
              color: '#334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Dự án:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{project.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Mã dự án (Key):</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{project.project_key || 'KAN'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b' }}>File dự kiến:</span>
              <code style={{ color: '#2563eb', backgroundColor: '#eff6ff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                AI-Jira-Agent-{(project.project_key || 'KAN').toUpperCase()}-{new Date().toISOString().slice(0, 10)}.{format === 'markdown' ? 'md' : 'pdf'}
              </code>
            </div>
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            margin: 0,
          }}
        >
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
