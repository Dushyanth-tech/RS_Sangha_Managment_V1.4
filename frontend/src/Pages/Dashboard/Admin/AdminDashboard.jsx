import React, { useCallback, useEffect,useState } from "react";
import api from "../../../api/axiosInstance";   // was missing: the pending-requests badge never loaded without it
import Sidebar from "./components/Sidebar";
import Topbar from "../../../Common_Component/Topbar";
import Overview from "./pages/Overview";
import ManageSanghas from "./pages/ManageSanghas";
import Attendance from "./pages/Attendance";
import ManageMembers from "../SuperAdmin/pages/ManageMembers";
import SanghaSavingsAccount from "./pages/SanghaSavingsAccount";
import ManageNotifications from "../SuperAdmin/pages/ManageNotifications";
import AdminRequests from "./pages/AdminRequests";
import FundRequests from "../SuperAdmin/pages/FundRequests";
import SettingsPage from "../Member/pages/SettingsPage";
import "../SuperAdmin/SuperAdminDashboard.css"; // reuse the sa- theme tokens/layout

const PAGE_TITLES = {
  overview: "Dashboard",
  sanghas: "My Sanghas",
  members: "Manage Members",
  attendance: "Member Attendance",
  SavingsAccount: "Sanghas Savings Account",
  notifications: "Manage Notification",
  "admin-requests": "Make Admin",
  settings: "Settings",
};

const PAGES = {
  overview: Overview,
  sanghas: ManageSanghas,
  members: ManageMembers,
  attendance: Attendance,
  SavingsAccount: SanghaSavingsAccount,
  "fund-requests": FundRequests,
  notifications: ManageNotifications,
  "admin-requests": AdminRequests,
  settings: SettingsPage,
};

const AdminDashboard = () => {
  const [activePage, setActivePage] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/auth";
  };

  const ActivePageComponent = PAGES[activePage] ?? Overview;
  const navigateToPage = (page) => {
    setActivePage(page);
    setDrawerOpen(false);
  };

  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const res = await api.get("/sangha-savings/inbox/count");
      setPendingCount(res.data.count);
    } catch (err) {
      console.error("Unable to load pending request count:", err);
    }
  }, []);

  // On load, whenever the page changes, every 30 seconds, and when the tab regains focus
  useEffect(() => {
    refreshPendingCount();
    const timer = setInterval(refreshPendingCount, 30000);
    window.addEventListener("focus", refreshPendingCount);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshPendingCount);
    };
  }, [refreshPendingCount, activePage]);

  return (
    <div className="sa-shell">
      {drawerOpen && (
        <button
          type="button"
          className="sa-shell__scrim"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <Sidebar
        activePage={activePage}
        onNavigate={navigateToPage}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
      />
      <div className="sa-shell__main">
        <Topbar
          onLogout={handleLogout}
          notificationCount={pendingCount}
          onNotificationsClick={() => navigateToPage("fund-requests")}
          onMenuClick={() => setDrawerOpen((open) => !open)}
          menuOpen={drawerOpen}
        />

        <main className="sa-shell__content">
          <ActivePageComponent
            onChanged={refreshPendingCount}
            onLogout={activePage === "settings" ? handleLogout : undefined}
          />
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;