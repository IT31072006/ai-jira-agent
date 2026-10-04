import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, LayoutDashboard, FolderGit2, Settings, LogOut } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isDashboard = location.pathname === '/dashboard';
  const isProjects = location.pathname.startsWith('/projects');
  const isSettings = location.pathname === '/settings';

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          <Link to="/dashboard" className="navbar-brand">
            <div className="brand-badge">
              <Sparkles size={20} className="icon-sparkle" />
            </div>
            <div>
              <h2 className="brand-title">AI Requirement-to-Jira</h2>
              <span className="brand-tag">Agent Platform</span>
            </div>
          </Link>

          <nav className="nav-links">
            <Link
              to="/dashboard"
              className={`nav-link ${isDashboard ? 'active' : ''}`}
            >
              <LayoutDashboard size={17} />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/projects"
              className={`nav-link ${isProjects ? 'active' : ''}`}
            >
              <FolderGit2 size={17} />
              <span>Projects</span>
            </Link>
            <Link
              to="/settings"
              className={`nav-link ${isSettings ? 'active' : ''}`}
              id="nav-settings-link"
            >
              <Settings size={17} />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        <div className="navbar-user">
          <div className="user-info">
            <span className="user-name">{user?.name || 'Người dùng'}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button
            onClick={logout}
            className="btn btn-outline btn-sm btn-logout"
            id="navbar-logout-btn"
            title="Đăng xuất"
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
