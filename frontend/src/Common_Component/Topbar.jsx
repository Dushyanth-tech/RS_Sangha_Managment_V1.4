import React from "react";
import { Search, Bell, LogOut, Menu, X } from "lucide-react";
import "./Topbar.css";

// Same localStorage structure as before, with a safe fallback for missing/invalid data
const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    return {};
  }
};

export default function Topbar({
  onLogout,
  notificationCount = 0,
  onNotificationsClick,
  onMenuClick,
  menuOpen = false,
}) {
  const user = readUser();
  const fullname = user.fullname || "";
  const initial = fullname ? fullname.charAt(0).toUpperCase() : "?";

  return (
    <header className="tb">
      {onMenuClick && (
        <button
          type="button"
          className="tb__menu"
          onClick={onMenuClick}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}
      <div className="tb__search">
        <Search className="tb__search-icon" size={18} aria-hidden="true" />
        <input
          className="tb__search-input"
          type="search"
          placeholder="Search admins, sanghas, members..."
          aria-label="Search admins, sanghas, members"
        />
      </div>

      <button
        type="button"
        className="tb__bell"
        onClick={onNotificationsClick}
        aria-label={
          notificationCount > 0
            ? `Notifications, ${notificationCount} unread`
            : "Notifications"
        }
      >
        <Bell size={20} />
        {notificationCount > 0 && (
          <span className="tb__badge">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </button>

      <div className="tb__profile">
        <div className="tb__avatar" aria-hidden="true">
          {initial}
        </div>
        {fullname && <span className="tb__name">{fullname}</span>}
      </div>

      <button
        type="button"
        className="tb__logout"
        onClick={onLogout}
        aria-label="Logout"
      >
        <LogOut size={16} className="tb__logout-icon" />
        <span className="tb__logout-text">Logout</span>
      </button>
    </header>
  );
}