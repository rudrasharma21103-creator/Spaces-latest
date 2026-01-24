import React, { useEffect, useState, useRef } from "react";
import { connectUserSocket } from "./services/ws";
import { getStoredUser, getToken } from "./services/auth";

const API_BASE = (() => {
  try {
    return import.meta.env.VITE_API_URL || window.location.origin;
  } catch (e) {
    return import.meta.env.VITE_API_URL || "http://localhost:8000";
  }
})();

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingPerUser, setSavingPerUser] = useState({});
  const sockRef = useRef(null);

  // Fetch admin overview
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const user = getStoredUser();
        let domain = null;
        if (user && user.email)
          domain = (user.email.match(/@([A-Za-z0-9.-]+)$/) || [])[1];
        if (!domain) throw new Error("Missing domain");
        const res = await fetch(
          `${API_BASE}/api/admin/overview?domain=${encodeURIComponent(domain)}`
        );
        if (!res.ok) throw new Error("Failed fetching overview");
        const j = await res.json();
        setOverview(j);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Realtime updates
  useEffect(() => {
    const sock = connectUserSocket((data) => {
      if (!data) return;
      if (data.type === "presence_update") {
        const onlineSet = new Set(data.online_users || []);
        setOverview((prev) => {
          if (!prev) return prev;
          const copy = { ...prev };
          copy.employees = (copy.employees || []).map((emp) => ({
            ...emp,
            isOnline: onlineSet.has(String(emp.id || emp.email)),
          }));
          return copy;
        });
      }
      if (data.type === "user_presence") {
        const ev = data;
        setOverview((prev) => {
          if (!prev) return prev;
          const copy = { ...prev };
          copy.employees = (copy.employees || []).map((emp) =>
            emp.email === ev.email
              ? { ...emp, isOnline: ev.event === "online", lastActive: ev.timestamp }
              : emp
          );
          return copy;
        });
      }
      if (data.type === "invite_permissions_updated") {
        const ev = data;
        setOverview((prev) => {
          if (!prev) return prev;
          const copy = { ...prev };
          copy.employees = (copy.employees || []).map((emp) =>
            String(emp.email) === String(ev.email)
              ? { ...emp, invitePermissions: ev.invitePermissions }
              : emp
          );
          return copy;
        });
      }
    });
    sockRef.current = sock;
    return () => {
      try {
        sock.close();
      } catch (e) {}
    };
  }, []);

  // Change role
  const changeRole = async (email, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/users/by-email/${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error("user lookup failed");
      const u = await res.json();
      if (!u || !u.id) throw new Error("user not found");
      await fetch(`${API_BASE}/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      await refreshOverview();
    } catch (e) {
      console.error(e);
    }
  };

  const refreshOverview = async () => {
    const domain = overview?.company?.domain;
    if (domain) {
      const r2 = await fetch(
        `${API_BASE}/api/admin/overview?domain=${encodeURIComponent(domain)}`
      );
      if (r2.ok) setOverview(await r2.json());
    }
  };

  // --- FIXED FUNCTION START ---
  // Handle Invite Permissions per employee
  const handleInvitePermission = async (user, type) => {
    const { id, email } = user;
    const loadingKey = id || email; // Fallback to email if ID is missing for the loading state

    try {
      setSavingPerUser((prev) => ({ ...prev, [loadingKey]: true }));

      // Optimistic update: Match by EMAIL
      setOverview((prev) => ({
        ...prev,
        employees: prev.employees.map((emp) => {
          if (emp.email === email) { 
            return {
              ...emp,
              invitePermissions: {
                canInviteAll: type === "all",
                canInviteCompanyOnly: type === "company",
              },
              // Clear snake_case key to prevent conflicts during optimistic state
              invite_permissions: null 
            };
          }
          return emp;
        }),
      }));

      // Ensure we have an ID for the backend call
      let targetId = id;
      if (!targetId) {
        const res = await fetch(`${API_BASE}/users/by-email/${encodeURIComponent(email)}`);
        if (!res.ok) throw new Error("user lookup failed");
        const u = await res.json();
        targetId = u.id;
      }

      if (!targetId) throw new Error("User ID missing");

      // Backend update (include auth headers)
      const token = getToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      else {
        const su = getStoredUser();
        if (su && su.id) headers["X-User-Id"] = String(su.id);
      }

      const resp = await fetch(`${API_BASE}/users/${targetId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          invitePermissions: {
            canInviteAll: type === "all",
            canInviteCompanyOnly: type === "company",
          },
        }),
      });

      if (!resp.ok) {
        // revert optimistic change on failure
        console.error("Failed to update invitePermissions", resp.status);
        await refreshOverview();
        setSavingPerUser((prev) => ({ ...prev, [loadingKey]: false }));
        return;
      }

      // Refresh only this employee's permissions from backend
      const updatedOverview = await fetch(
        `${API_BASE}/api/admin/overview?domain=${overview?.company?.domain}`
      );
      if (updatedOverview.ok) {
        const json = await updatedOverview.json();
        setOverview((prev) => ({
          ...prev,
          employees: prev.employees.map((emp) => {
            // find the matching updated employee for this row
            const updatedEmp = json.employees.find((e) => String(e.email) === String(emp.email));
            if (updatedEmp) {
              // Normalize keys (Handle snake_case from backend vs camelCase from frontend)
              const rawPerms = updatedEmp.invitePermissions || updatedEmp.invite_permissions || {};
              return {
                ...emp,
                invitePermissions: {
                  canInviteAll: Boolean(rawPerms.canInviteAll || rawPerms.can_invite_all),
                  canInviteCompanyOnly: Boolean(rawPerms.canInviteCompanyOnly || rawPerms.can_invite_company_only),
                },
              };
            }
            return emp;
          }),
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPerUser((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };
  // --- FIXED FUNCTION END ---

  const isAdmin = overview?.company?.adminEmail === getStoredUser()?.email;

  if (loading)
    return <div className="p-8 text-slate-500">Loading admin dashboard...</div>;
  if (error)
    return <div className="p-8 text-red-600">Error loading dashboard: {error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {overview?.company?.logo && (
              <img
                src={overview.company.logo}
                alt="logo"
                className="w-14 h-14 rounded-md shadow"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                {overview?.company?.name || overview?.company?.domain}
              </h1>
              <div className="text-sm text-slate-500">
                {overview?.company?.domain}{" "}
                {overview?.company?.verified ? "✅ Verified" : ""}
              </div>
              <div className="text-xs text-slate-400">
                Admin: {overview?.company?.adminEmail}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Total Employees</div>
            <div className="text-3xl font-bold text-indigo-600">
              {overview?.stats?.totalEmployees || 0}
            </div>
          </div>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl shadow">
            <div className="text-sm text-slate-500">Active Today</div>
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-100">
              {overview?.stats?.activeToday || 0}
            </div>
          </div>
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl shadow">
            <div className="text-sm text-slate-500">Online Now</div>
            <div className="text-2xl font-bold text-emerald-600">
              {overview?.stats?.onlineNow || 0}
            </div>
          </div>
          <div className="p-5 bg-white dark:bg-slate-800 rounded-xl shadow">
            <div className="text-sm text-slate-500">Avg Daily Active Hours</div>
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-100">
              {(overview?.stats?.avgActiveHours || 0).toFixed(2)}
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mb-8">
          <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {(overview?.recentEvents || []).map((e, idx) => (
              <div
                key={idx}
                className="p-3 rounded-md bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-300"
              >
                {String(e.msg)}
              </div>
            ))}
            {(!overview?.recentEvents || overview.recentEvents.length === 0) && (
              <div className="text-sm text-slate-500">No recent events</div>
            )}
          </div>
        </section>

        {/* User Table */}
        <section>
          <h3 className="font-semibold mb-3 text-slate-700 dark:text-slate-200">
            User & Team Management
          </h3>
          <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-lg shadow">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 border-b dark:border-slate-700">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last Active</th>
                  <th className="px-4 py-2">Hours</th>
                  <th className="px-4 py-2">Invite Permissions</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.employees || []).map((u) => {
                  // Helper to safely resolve permissions (handles snake_case and camelCase)
                  const perms = u.invitePermissions || u.invite_permissions || {};
                  const isAll = perms.canInviteAll || perms.can_invite_all;
                  const isCompany = perms.canInviteCompanyOnly || perms.can_invite_company_only;

                  return (
                    <tr key={u.id || u.email} className="border-t dark:border-slate-700">
                      <td className="px-4 py-2">{u.name}</td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2">
                        <select
                          value={u.role || "user"}
                          onChange={(e) => changeRole(u.email, e.target.value)}
                          className="px-2 py-1 rounded-md border dark:bg-slate-700"
                        >
                          <option value="user">User</option>
                          <option value="employee">Employee</option>
                          <option value="org_admin">Org Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        {u.isOnline ? (
                          <span className="text-emerald-600 font-medium">🟢 Online</span>
                        ) : (
                          <span className="text-slate-400">⚪ Offline</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {u.lastActive
                          ? new Date(u.lastActive * 1000).toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2">{u.activeHours || 0}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 items-center">
                          <button
                            disabled={!isAdmin || savingPerUser[u.id || u.email]}
                            onClick={() => handleInvitePermission(u, "all")}
                            className={`px-3 py-1 rounded-md border text-xs transition ${
                              isAll
                                ? "bg-indigo-100 text-indigo-700 border-indigo-400"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            All
                          </button>
                          <button
                            disabled={!isAdmin || savingPerUser[u.id || u.email]}
                            onClick={() => handleInvitePermission(u, "company")}
                            className={`px-3 py-1 rounded-md border text-xs transition ${
                              isCompany
                                ? "bg-indigo-100 text-indigo-700 border-indigo-400"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                          >
                            Company-only
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}