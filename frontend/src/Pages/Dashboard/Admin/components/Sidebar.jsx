import React from "react";
import {
  House,
  ShieldCheck,
  Users,
  Building2,
  Mail,
  ClipboardList,
  Bell,
  PiggyBank,
  CalendarCheck,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: House },
  { key: "sanghas", label: "My Sanghas", icon: Building2 },
  { key: "members", label: "Manage Members", icon: Users },
  { key: "SavingsAccount", label: "Sanghas Savings Account", icon: PiggyBank },
  { key: "attendance", label: "Member Attendance", icon: CalendarCheck },
  { key: "notifications", label: "Manage Notifications", icon: Bell },
  { key: "admin-requests", label: "Make Admin", icon: Mail },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ activePage, onNavigate, collapsed, drawerOpen = false }) {
  return (
    <aside
      className={`sa-sidebar ${
        collapsed ? "sa-sidebar--collapsed" : ""
      } ${drawerOpen ? "sa-sidebar--open" : ""}`}
      aria-label="Dashboard navigation"
    >
      <div className="sa-sidebar__brand">
        <span className="sa-sidebar__mark">RS</span>

        {!collapsed && (
          <span className="sa-sidebar__brand-text">
            Admin
          </span>
        )}
      </div>

      <nav className="sa-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              className={`sa-sidebar__link ${
                activePage === item.key
                  ? "sa-sidebar__link--active"
                  : ""
              }`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="sa-sidebar__icon">
                <Icon size={20} strokeWidth={2} />
              </span>

              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="sa-sidebar__footer">
          <span className="sa-sidebar__badge">Admin</span>
        </div>
      )}
    </aside>
  );
}