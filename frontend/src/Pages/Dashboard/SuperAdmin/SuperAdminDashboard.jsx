import React, { useCallback, useEffect,useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "../../../Common_Component/Topbar";
import Overview from "./pages/Overview";
import ManageAdmins from "./pages/ManageAdmins";
import ManageSanghas from "./pages/ManageSanghas";
import ManageMembers from "./pages/ManageMembers";
import SanghaSavingsAccount from "./pages/SanghaSavingsAccount";
import SubadminRequests from "./pages/SubadminRequests";
import ActivityLog from "./pages/ActivityLog";
import ManageNotifications from "./pages/ManageNotifications";
import FundRequests from "./pages/FundRequests";
import SettingsPage from "../Member/pages/SettingsPage";
import api from "../../../api/axiosInstance";
import "./SuperAdminDashboard.css";

const PAGE_TITLES = {
  overview: "Dashboard",
  admins: "Manage Admins",
  sanghas: "Manage Sanghas",
  members: "Manage Members",
  SavingsAccount: "Sanghas Savings Account",
  "subadmin-requests": "Subadmin Requests",
  notifications: "Manage Notification",
  "activity-log": "Activity Log",
  settings: "Settings",
};

const PAGES = {
  overview: Overview,
  admins: ManageAdmins,
  sanghas: ManageSanghas,
  members: ManageMembers,
  SavingsAccount: SanghaSavingsAccount,
  "subadmin-requests": SubadminRequests,
  "fund-requests": FundRequests,
  notifications: ManageNotifications,
  "activity-log": ActivityLog,
  settings: SettingsPage,
};

const SuperAdminDashboard = () => {
  const [activePage, setActivePage] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "/auth"; // Redirect to login page
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

export default SuperAdminDashboard;
