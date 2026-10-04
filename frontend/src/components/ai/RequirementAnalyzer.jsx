import React, { useState } from 'react';
import { analyzeRequirement } from '../../api/aiApi';
import {
  Sparkles,
  AlertCircle,
  Layers,
  Bookmark,
  CheckSquare,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  Edit3,
  Lock,
  Unlock,
} from 'lucide-react';

// ─── Helper: chuẩn hóa dữ liệu từ API thành cấu trúc phẳng để edit ───────────
const normalizeEpics = (result) => {
  let raw = [];
  if (!result) return [];
  if (Array.isArray(result)) raw = result;
  else if (Array.isArray(result.epics)) raw = result.epics;
  else if (result.data && Array.isArray(result.data.epics)) raw = result.data.epics;
  else if (result.result && Array.isArray(result.result.epics)) raw = result.result.epics;
  else return [];

  return raw.map((epic, ei) => ({
    id: `epic-${ei}`,
    title: epic.title || epic.name || epic.epic_name || epic.summary || `Epic #${ei + 1}`,
    description: epic.description || epic.details || epic.desc || '',
    stories: (epic.stories || epic.user_stories || epic.userStories || []).map((story, si) => ({
      id: `epic-${ei}-story-${si}`,
      title:
        story.title ||
        story.name ||
        story.user_story ||
        story.summary ||
        `User Story #${si + 1}`,
      description: story.description || story.desc || '',
      tasks: (story.tasks || story.subtasks || []).map((task, ti) => ({
        id: `epic-${ei}-story-${si}-task-${ti}`,
        title:
          typeof task === 'string'
            ? task
            : task.title || task.name || task.summary || `Task #${ti + 1}`,
        description: typeof task === 'object' ? task.description || task.desc || '' : '',
      })),
    })),
  }));
};

// ─── Component chính ──────────────────────────────────────────────────────────
export const RequirementAnalyzer = () => {
  const [requirement, setRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // editableEpics: mảng làm việc có thể sửa đổi
  const [editableEpics, setEditableEpics] = useState(null);

  // confirmed: true = đã xác nhận, khoá chỉnh sửa
  const [confirmed, setConfirmed] = useState(false);

  // ── Flow 5: gọi AI ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!requirement.trim()) {
      setError('Vui lòng nhập nội dung yêu cầu phần mềm.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setEditableEpics(null);
      setConfirmed(false);

      const data = await analyzeRequirement(requirement.trim());
      setEditableEpics(normalizeEpics(data));
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Đã có lỗi xảy ra khi kết nối tới dịch vụ AI.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Flow 6: helpers cập nhật state editableEpics (immutable) ────────────────

  const updateEpicField = (epicIdx, field, value) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => (ei === epicIdx ? { ...epic, [field]: value } : epic))
    );
  };

  const updateStoryField = (epicIdx, storyIdx, field, value) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.map((story, si) =>
            si === storyIdx ? { ...story, [field]: value } : story
          ),
        };
      })
    );
  };

  const updateTaskField = (epicIdx, storyIdx, taskIdx, field, value) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.map((story, si) => {
            if (si !== storyIdx) return story;
            return {
              ...story,
              tasks: story.tasks.map((task, ti) =>
                ti === taskIdx ? { ...task, [field]: value } : task
              ),
            };
          }),
        };
      })
    );
  };

  const addStory = (epicIdx) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        const newStory = {
          id: `epic-${epicIdx}-story-${Date.now()}`,
          title: 'User Story mới',
          description: '',
          tasks: [],
        };
        return { ...epic, stories: [...epic.stories, newStory] };
      })
    );
  };

  const deleteStory = (epicIdx, storyIdx) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.filter((_, si) => si !== storyIdx),
        };
      })
    );
  };

  const addTask = (epicIdx, storyIdx) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.map((story, si) => {
            if (si !== storyIdx) return story;
            const newTask = {
              id: `task-${Date.now()}`,
              title: 'Task mới',
              description: '',
            };
            return { ...story, tasks: [...story.tasks, newTask] };
          }),
        };
      })
    );
  };

  const deleteTask = (epicIdx, storyIdx, taskIdx) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.map((story, si) => {
            if (si !== storyIdx) return story;
            return { ...story, tasks: story.tasks.filter((_, ti) => ti !== taskIdx) };
          }),
        };
      })
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="card requirement-analyzer-card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title-group">
          <Sparkles className="card-icon text-primary" size={20} />
          <h3>Phân tích Yêu cầu Phần mềm bằng AI</h3>
        </div>
      </div>

      <div className="card-body">
        <p className="text-muted">
          Nhập mô tả yêu cầu tính năng bằng ngôn ngữ tự nhiên bên dưới. Hệ thống AI sẽ phân tích
          và tự động bóc tách thành cấu trúc{' '}
          <strong>Epic → User Story → Task</strong>.
        </p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} className="alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Form nhập requirement ─────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="analyzer-form">
          <div className="form-group">
            <label htmlFor="requirement-input">Nội dung Yêu cầu (Requirement)</label>
            <textarea
              id="requirement-input"
              className="form-control analyzer-textarea"
              rows={5}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="Ví dụ: Hệ thống cho phép người dùng đăng ký, đăng nhập bằng Email hoặc Google, khôi phục mật khẩu qua Email OTP..."
              disabled={loading || confirmed}
            />
          </div>

          <div className="analyzer-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !requirement.trim() || confirmed}
              id="btn-analyze-ai"
            >
              {loading ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner"></span>
                  <span>AI đang phân tích...</span>
                </span>
              ) : (
                <span className="btn-content">
                  <Sparkles size={16} />
                  <span>Phân tích bằng AI</span>
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Đang gửi yêu cầu tới AI Agent để xử lý và phân tách...</p>
          </div>
        )}

        {/* ── Kết quả + chỉnh sửa (Flow 5 + 6) ───────────────────────────────── */}
        {editableEpics !== null && (
          <div className="analysis-results-section">
            {/* Tiêu đề kết quả + trạng thái xác nhận */}
            <div className="results-header">
              <div className="results-title-group">
                <FileText size={18} className="text-primary" />
                <h4>Kết quả Phân tích Requirement</h4>
              </div>
              <div className="results-header-right">
                <span className="badge badge-success">
                  {editableEpics.length} Epic{editableEpics.length !== 1 ? 's' : ''} được bóc tách
                </span>
                {confirmed && (
                  <span className="badge badge-confirmed">
                    <CheckCircle2 size={13} />
                    Đã xác nhận
                  </span>
                )}
              </div>
            </div>

            {/* Banner trạng thái xác nhận */}
            {confirmed && (
              <div className="confirmed-banner">
                <CheckCircle2 size={20} className="confirmed-banner-icon" />
                <div>
                  <strong>Kết quả đã được xác nhận.</strong>
                  <p>Bạn có thể nhấn "Chỉnh sửa lại" để mở khoá và tiếp tục điều chỉnh.</p>
                </div>
              </div>
            )}

            {/* Nếu API trả về epics chuẩn */}
            {editableEpics.length > 0 ? (
              <div className="epics-container">
                {editableEpics.map((epic, epicIdx) => (
                  <div key={epic.id} className={`epic-card${confirmed ? ' epic-card--locked' : ''}`}>
                    {/* ── Epic header ─────────────────────────────────────── */}
                    <div className="epic-header">
                      <div className="epic-title-container">
                        <Layers size={22} className="epic-icon" />
                        <div className="epic-fields">
                          <span className="badge badge-primary-subtle">EPIC</span>
                          {confirmed ? (
                            <>
                              <h4 className="epic-name">{epic.title}</h4>
                              {epic.description && (
                                <p className="epic-desc">{epic.description}</p>
                              )}
                            </>
                          ) : (
                            <>
                              <input
                                type="text"
                                className="form-control edit-field-title"
                                value={epic.title}
                                onChange={(e) =>
                                  updateEpicField(epicIdx, 'title', e.target.value)
                                }
                                placeholder="Tên Epic"
                              />
                              <textarea
                                className="form-control edit-field-desc"
                                value={epic.description}
                                onChange={(e) =>
                                  updateEpicField(epicIdx, 'description', e.target.value)
                                }
                                placeholder="Mô tả Epic (tuỳ chọn)"
                                rows={2}
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <span className="badge badge-outline">
                        {epic.stories.length} User{' '}
                        {epic.stories.length === 1 ? 'Story' : 'Stories'}
                      </span>
                    </div>

                    {/* ── Stories ─────────────────────────────────────────── */}
                    <div className="stories-list">
                      {epic.stories.map((story, storyIdx) => (
                        <div
                          key={story.id}
                          className={`story-card${confirmed ? ' story-card--locked' : ''}`}
                        >
                          {/* Story header */}
                          <div className="story-header">
                            <Bookmark size={18} className="story-icon" />
                            <div className="story-fields">
                              <div className="story-badge-row">
                                <span className="badge badge-accent-subtle">STORY</span>
                                {!confirmed && (
                                  <button
                                    type="button"
                                    className="btn-icon btn-icon-danger"
                                    title="Xóa Story này"
                                    onClick={() => deleteStory(epicIdx, storyIdx)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                              {confirmed ? (
                                <>
                                  <h5 className="story-name">{story.title}</h5>
                                  {story.description && (
                                    <p className="story-desc">{story.description}</p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    className="form-control edit-field-title"
                                    value={story.title}
                                    onChange={(e) =>
                                      updateStoryField(epicIdx, storyIdx, 'title', e.target.value)
                                    }
                                    placeholder="Tên User Story"
                                  />
                                  <textarea
                                    className="form-control edit-field-desc"
                                    value={story.description}
                                    onChange={(e) =>
                                      updateStoryField(
                                        epicIdx,
                                        storyIdx,
                                        'description',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Mô tả User Story (tuỳ chọn)"
                                    rows={2}
                                  />
                                </>
                              )}
                            </div>
                          </div>

                          {/* ── Tasks ─────────────────────────────────────── */}
                          <div className="tasks-container">
                            <span className="tasks-label">
                              Tasks ({story.tasks.length}):
                            </span>
                            <div className="tasks-list">
                              {story.tasks.map((task, taskIdx) => (
                                <div key={task.id} className="task-item task-item--editable">
                                  <div className="task-left">
                                    <CheckSquare size={15} className="task-icon" />
                                    {confirmed ? (
                                      <span>{task.title}</span>
                                    ) : (
                                      <div className="task-edit-fields">
                                        <input
                                          type="text"
                                          className="form-control edit-field-title"
                                          value={task.title}
                                          onChange={(e) =>
                                            updateTaskField(
                                              epicIdx,
                                              storyIdx,
                                              taskIdx,
                                              'title',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Tên Task"
                                        />
                                        <input
                                          type="text"
                                          className="form-control edit-field-subdesc"
                                          value={task.description}
                                          onChange={(e) =>
                                            updateTaskField(
                                              epicIdx,
                                              storyIdx,
                                              taskIdx,
                                              'description',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Mô tả ngắn (tuỳ chọn)"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  {!confirmed && (
                                    <button
                                      type="button"
                                      className="btn-icon btn-icon-danger"
                                      title="Xóa Task này"
                                      onClick={() => deleteTask(epicIdx, storyIdx, taskIdx)}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Thêm Task */}
                            {!confirmed && (
                              <button
                                type="button"
                                className="btn-add-item"
                                onClick={() => addTask(epicIdx, storyIdx)}
                              >
                                <Plus size={14} />
                                <span>Thêm Task</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Thêm Story */}
                      {!confirmed && (
                        <button
                          type="button"
                          className="btn-add-item btn-add-story"
                          onClick={() => addStory(epicIdx)}
                        >
                          <Plus size={14} />
                          <span>Thêm Story</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback */
              <div className="raw-response-fallback">
                <p className="text-muted">Đã nhận phản hồi từ AI Agent:</p>
                <pre className="json-code-block">
                  {JSON.stringify(editableEpics, null, 2)}
                </pre>
              </div>
            )}

            {/* ── Nút hành động chính (Flow 6) ─────────────────────────────── */}
            <div className="validation-actions">
              {!confirmed ? (
                <button
                  type="button"
                  className="btn btn-primary btn-confirm"
                  onClick={() => setConfirmed(true)}
                >
                  <Lock size={16} />
                  <span>Xác nhận kết quả</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-reopen"
                  onClick={() => setConfirmed(false)}
                >
                  <Unlock size={16} />
                  <span>Chỉnh sửa lại</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequirementAnalyzer;
