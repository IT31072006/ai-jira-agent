import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyzeRequirement } from '../../api/aiApi';
import { jiraApi } from '../../api/jiraApi';
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
  CloudUpload,
  ExternalLink,
  Users,
  UserCheck,
  RefreshCw,
  User,
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
      assigneeId: story.assigneeId || null,
      assigneeName: story.assigneeName || '',
      assigneeAvatar: story.assigneeAvatar || '',
      tasks: (story.tasks || story.subtasks || []).map((task, ti) => ({
        id: `epic-${ei}-story-${si}-task-${ti}`,
        title:
          typeof task === 'string'
            ? task
            : task.title || task.name || task.summary || `Task #${ti + 1}`,
        description: typeof task === 'object' ? task.description || task.desc || '' : '',
        assigneeId: typeof task === 'object' ? task.assigneeId || null : null,
        assigneeName: typeof task === 'object' ? task.assigneeName || '' : '',
        assigneeAvatar: typeof task === 'object' ? task.assigneeAvatar || '' : '',
      })),
    })),
  }));
};

// ─── Component chính ──────────────────────────────────────────────────────────
export const RequirementAnalyzer = ({ project }) => {
  const [requirement, setRequirement] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // editableEpics: mảng làm việc có thể sửa đổi
  const [editableEpics, setEditableEpics] = useState(null);

  // confirmed: true = đã xác nhận, khoá chỉnh sửa
  const [confirmed, setConfirmed] = useState(false);

  // ── Flow 7: Tích hợp Jira (Push to Jira) ──────────────────────────────────
  const getDefaultProjectKey = () => {
    if (!project?.name) return 'KAN';
    const clean = project.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    return clean.length >= 2 ? clean.slice(0, 6) : 'KAN';
  };

  const [jiraProjectKey, setJiraProjectKey] = useState(getDefaultProjectKey());
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const [jiraResult, setJiraResult] = useState(null);

  // ── Flow 8: Lấy danh sách thành viên Jira & Giao việc ────────────────────
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');

  const handleFetchMembers = async (customKey) => {
    const keyToUse = (customKey || jiraProjectKey || '').trim().toUpperCase();
    if (!keyToUse) {
      setMemberError('Vui lòng nhập Jira Project Key (ví dụ: KAN, PROJ) để lấy danh sách thành viên.');
      return;
    }
    try {
      setLoadingMembers(true);
      setMemberError('');
      const data = await jiraApi.getMembers(keyToUse);
      setMembers(data.members || []);
      if (!data.members || data.members.length === 0) {
        setMemberError('Không tìm thấy thành viên nào được cấp quyền trong dự án Jira này.');
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Không thể lấy danh sách thành viên từ Jira. Vui lòng kiểm tra lại cấu hình API trong Settings!';
      setMemberError(msg);
    } finally {
      setLoadingMembers(false);
    }
  };

  const countAssignedToMember = (accountId) => {
    if (!editableEpics) return 0;
    let count = 0;
    editableEpics.forEach((epic) => {
      epic.stories?.forEach((story) => {
        if (story.assigneeId === accountId) count++;
        story.tasks?.forEach((task) => {
          if (task.assigneeId === accountId) count++;
        });
      });
    });
    return count;
  };

  const updateTaskAssignee = (epicIdx, storyIdx, taskIdx, member) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.map((story, si) => {
            if (si !== storyIdx) return story;
            return {
              ...story,
              tasks: story.tasks.map((task, ti) => {
                if (ti !== taskIdx) return task;
                return {
                  ...task,
                  assigneeId: member ? member.accountId : null,
                  assigneeName: member ? member.displayName : '',
                  assigneeAvatar: member ? member.avatarUrl : '',
                };
              }),
            };
          }),
        };
      })
    );
  };

  const updateStoryAssignee = (epicIdx, storyIdx, member) => {
    setEditableEpics((prev) =>
      prev.map((epic, ei) => {
        if (ei !== epicIdx) return epic;
        return {
          ...epic,
          stories: epic.stories.map((story, si) => {
            if (si !== storyIdx) return story;
            return {
              ...story,
              assigneeId: member ? member.accountId : null,
              assigneeName: member ? member.displayName : '',
              assigneeAvatar: member ? member.avatarUrl : '',
            };
          }),
        };
      })
    );
  };

  const handlePushToJira = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!jiraProjectKey.trim()) {
      setPushError('Vui lòng nhập Jira Project Key (ví dụ: KAN, PROJ).');
      return;
    }
    if (!editableEpics || editableEpics.length === 0) {
      setPushError('Chưa có danh sách Epic để đẩy lên Jira.');
      return;
    }

    try {
      setPushLoading(true);
      setPushError('');
      setJiraResult(null);

      const res = await jiraApi.pushToJira({
        projectKey: jiraProjectKey.trim().toUpperCase(),
        epics: editableEpics,
      });

      setJiraResult(res.data || res);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Có lỗi xảy ra khi gọi Express và n8n để đẩy dữ liệu lên Jira.';
      setPushError(msg);
    } finally {
      setPushLoading(false);
    }
  };

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
          assigneeId: null,
          assigneeName: '',
          assigneeAvatar: '',
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
              assigneeId: null,
              assigneeName: '',
              assigneeAvatar: '',
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span className="badge badge-accent-subtle">STORY</span>
                                  {members.length > 0 && (
                                    <div className="story-assignee-select-wrap" title="Gán thành viên Jira cho Story này">
                                      <User size={12} className="text-muted" />
                                      <select
                                        className="story-assignee-select"
                                        value={story.assigneeId || ''}
                                        onChange={(e) => {
                                          const selected = members.find((m) => m.accountId === e.target.value);
                                          updateStoryAssignee(epicIdx, storyIdx, selected || null);
                                        }}
                                      >
                                        <option value="">👤 Giao Story (Tùy chọn)</option>
                                        {members.map((m) => (
                                          <option key={m.accountId} value={m.accountId}>
                                            {m.displayName}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {story.assigneeName && members.length === 0 && (
                                    <span className="task-assignee-badge">
                                      <UserCheck size={11} />
                                      <span>{story.assigneeName}</span>
                                    </span>
                                  )}
                                </div>
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
                                      <div className="task-title-confirmed">
                                        <span>{task.title}</span>
                                        {task.description && (
                                          <span className="task-subdesc-muted"> — {task.description}</span>
                                        )}
                                      </div>
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

                                  <div className="task-right-actions">
                                    {/* Luồng 8: Assignee Selector cho Task */}
                                    {members.length > 0 ? (
                                      <div className="task-assignee-select-wrap" title="Gán thành viên Jira cho Task này">
                                        <User size={12} className="text-muted" />
                                        <select
                                          className="task-assignee-select"
                                          value={task.assigneeId || ''}
                                          onChange={(e) => {
                                            const selected = members.find((m) => m.accountId === e.target.value);
                                            updateTaskAssignee(epicIdx, storyIdx, taskIdx, selected || null);
                                          }}
                                        >
                                          <option value="">👤 Chưa giao</option>
                                          {members.map((m) => (
                                            <option key={m.accountId} value={m.accountId}>
                                              {m.displayName}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ) : task.assigneeName ? (
                                      <span className="task-assignee-badge">
                                        <UserCheck size={11} />
                                        <span>{task.assigneeName}</span>
                                      </span>
                                    ) : null}

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
                  onClick={() => {
                    setConfirmed(false);
                    setJiraResult(null);
                  }}
                >
                  <Unlock size={16} />
                  <span>Chỉnh sửa lại</span>
                </button>
              )}
            </div>

            {/* ── Flow 7: Tích hợp Jira (Push to Jira qua n8n) ──────────────── */}
            {confirmed && (
              <div className="jira-integration-section">
                <div className="jira-integration-header">
                  <div className="jira-title-group">
                    <CloudUpload className="text-primary" size={24} />
                    <div>
                      <h4>Tích hợp Jira (Luồng 7: Push to Jira)</h4>
                      <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                        Cỗ máy n8n sẽ tự động chạy vòng lặp tạo <strong>Epic ➔ Story ➔ Sub-task</strong> trên Jira
                      </span>
                    </div>
                  </div>
                </div>

                {pushError && (
                  <div className="alert alert-error">
                    <AlertCircle size={18} className="alert-icon" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                      <span>{pushError}</span>
                      {pushError.includes('Cài đặt') && (
                        <Link
                          to="/settings"
                          className="btn btn-outline"
                          style={{
                            width: 'fit-content',
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.8rem',
                            borderColor: 'var(--primary)',
                            color: '#a5b4fc',
                          }}
                        >
                          ⚙️ Đi tới trang Cài đặt (Settings)
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Flow 8: Danh sách thành viên Jira (Team Members / Assignees) ── */}
                <div className="jira-members-section">
                  <div className="jira-members-header">
                    <div className="jira-members-title-group">
                      <Users className="text-primary" size={20} />
                      <div>
                        <h5 className="jira-members-title-heading">
                          Thành viên dự án Jira (Luồng 8: Lấy danh sách & Phân công)
                        </h5>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          Gọi Jira API để lấy danh sách Lập trình viên / Tester trong team và giao việc trực tiếp
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-fetch-members"
                      onClick={() => handleFetchMembers()}
                      disabled={loadingMembers || !jiraProjectKey.trim()}
                      id="btn-fetch-jira-members"
                    >
                      {loadingMembers ? (
                        <>
                          <span className="btn-spinner" style={{ width: 14, height: 14 }}></span>
                          <span>Đang tải thành viên...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          <span>{members.length > 0 ? 'Tải lại thành viên' : 'Lấy danh sách thành viên'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {memberError && (
                    <div className="alert alert-error" style={{ margin: '0.5rem 0' }}>
                      <AlertCircle size={16} className="alert-icon" />
                      <span style={{ fontSize: '0.85rem' }}>{memberError}</span>
                    </div>
                  )}

                  {members.length > 0 ? (
                    <div className="jira-members-grid">
                      {members.map((m) => {
                        const assignedCount = countAssignedToMember(m.accountId);
                        return (
                          <div key={m.accountId} className="jira-member-card">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.displayName} className="jira-member-avatar" />
                            ) : (
                              <div className="jira-member-avatar-placeholder">
                                {m.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="jira-member-details">
                              <span className="jira-member-name">{m.displayName}</span>
                              {m.emailAddress && (
                                <span className="jira-member-email">{m.emailAddress}</span>
                              )}
                            </div>
                            <span
                              className={`jira-member-count-badge ${assignedCount > 0 ? 'has-tasks' : ''}`}
                              title={`${assignedCount} nhiệm vụ được gán cho ${m.displayName}`}
                            >
                              {assignedCount} task{assignedCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !loadingMembers && (
                      <div className="jira-members-empty-hint">
                        <Users size={16} className="text-muted" />
                        <span>
                          Nhập mã dự án <strong>{jiraProjectKey || 'Project Key'}</strong> rồi bấm <strong>"Lấy danh sách thành viên"</strong> để xem các thành viên Jira và chọn người thực hiện cho từng Task/Story ở trên!
                        </span>
                      </div>
                    )
                  )}
                </div>

                <form onSubmit={handlePushToJira} className="jira-push-form">
                  <div className="jira-input-row">
                    <div className="jira-key-group">
                      <label htmlFor="jira-project-key">Jira Project Key (Mã dự án Jira)</label>
                      <input
                        id="jira-project-key"
                        type="text"
                        className="form-control jira-key-input"
                        placeholder="VD: KAN, PROJ..."
                        value={jiraProjectKey}
                        onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                        disabled={pushLoading}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-push-jira"
                      disabled={pushLoading || !jiraProjectKey.trim()}
                      id="btn-push-to-jira"
                    >
                      {pushLoading ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>n8n đang tạo issues trên Jira...</span>
                        </>
                      ) : (
                        <>
                          <CloudUpload size={18} />
                          <span>Đẩy dữ liệu lên Jira</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Kết quả sau khi n8n tạo xong trên Jira */}
                {jiraResult && (
                  <div className="jira-result-card">
                    <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
                      <CheckCircle2 size={18} className="alert-icon" />
                      <span>{jiraResult.message || 'Đã tạo thành công cấu trúc công việc trên Jira qua n8n!'}</span>
                    </div>

                    {jiraResult.summary && (
                      <div className="jira-stats-bar">
                        <div className="jira-stat-item">
                          <span className="jira-stat-num">{jiraResult.summary.epicsCount || 0}</span>
                          <span className="jira-stat-label">Epics</span>
                        </div>
                        <div className="jira-stat-item">
                          <span className="jira-stat-num">{jiraResult.summary.storiesCount || 0}</span>
                          <span className="jira-stat-label">Stories</span>
                        </div>
                        <div className="jira-stat-item">
                          <span className="jira-stat-num">{jiraResult.summary.tasksCount || 0}</span>
                          <span className="jira-stat-label">Sub-tasks</span>
                        </div>
                        <div className="jira-stat-item">
                          <span className="jira-stat-num" style={{ color: '#4ade80' }}>
                            {jiraResult.summary.totalIssues || 0}
                          </span>
                          <span className="jira-stat-label">Tổng Issues</span>
                        </div>
                      </div>
                    )}

                    {jiraResult.createdIssues && jiraResult.createdIssues.length > 0 && (
                      <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.65rem' }}>
                          DANH SÁCH ISSUES ĐÃ TẠO TRÊN JIRA:
                        </p>
                        <div className="jira-issues-list">
                          {jiraResult.createdIssues.map((issue, idx) => (
                            <div key={idx} className="jira-issue-row">
                              <div className="jira-issue-info">
                                <span
                                  className={`jira-badge ${
                                    issue.type === 'Epic'
                                      ? 'badge-jira-epic'
                                      : issue.type === 'Story'
                                      ? 'badge-jira-story'
                                      : 'badge-jira-subtask'
                                  }`}
                                >
                                  {issue.type}
                                </span>
                                <span className="jira-key-badge">{issue.key}</span>
                                <span className="jira-issue-title" title={issue.title}>
                                  {issue.title}
                                </span>
                                {issue.assignee && (
                                  <span className="jira-issue-assignee-tag" title={`Được giao cho ${issue.assignee}`}>
                                    <UserCheck size={11} />
                                    <span>{issue.assignee}</span>
                                  </span>
                                )}
                              </div>
                              {issue.url && (
                                <a
                                  href={issue.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="jira-link-btn"
                                >
                                  <span>Xem trên Jira</span>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequirementAnalyzer;
