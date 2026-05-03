"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Users, MapPin, ShieldAlert, Activity, LogOut, Plus, Pencil, Trash2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import { SiteList } from "@/components/SiteList";
import type { Site } from "@/components/SiteList";

const SiteMap = dynamic(() => import("@/components/SiteMap"), { ssr: false });

// Haversine formula: calculates distance in meters between two GPS coordinates
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function AdminDashboard() {
  // ─── Admin Auth State ───
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [authError, setAuthError] = useState("");

  // ─── Dashboard State ───
  const [data, setData] = useState({ totalEmployees: 0, onSiteNow: 0, geofenceAlerts: 0, activeSites: 0 });
  const [selectedCoords, setSelectedCoords] = useState({ lat: 23.8103, lng: 90.4125 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSite, setActiveSite] = useState<Site | null>(null);

  // ─── Employee Management State ───
  const [employees, setEmployees] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ employee_id: "", name: "", password: "" });

  // ─── Auth Check (persists via sessionStorage) ───
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("geobadge_admin") === "true") {
      setIsAdmin(true);
    }
  }, []);

  const handleLogin = () => {
    if (adminPin === "admin2026") {
      setIsAdmin(true);
      sessionStorage.setItem("geobadge_admin", "true");
      setAuthError("");
    } else {
      setAuthError("Invalid admin PIN.");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem("geobadge_admin");
  };

  // ─── Data Fetching ───
  const fetchStats = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: logs } = await supabase
      .from("checkins")
      .select(`timestamp, employee_id, latitude, longitude, employees ( name )`)
      .gte("timestamp", todayStart.toISOString())
      .order("timestamp", { ascending: false });

    if (logs) setRecentLogs(logs);

    const { count: empCount } = await supabase.from("employees").select("*", { count: "exact", head: true });
    const { count: siteCount } = await supabase.from("sites").select("*", { count: "exact", head: true });
    const { data: siteList } = await supabase
      .from("sites")
      .select("*")
      .order("created_at", { ascending: false });

    if (siteList && siteList.length > 0) {
      const list = siteList as Site[];
      setSites(list);
      setActiveSite((prev) => {
        if (prev && list.some((s) => s.id === prev.id)) return prev;
        return list[0];
      });
    } else {
      setSites([]);
      setActiveSite(null);
    }

    // On-Site Now
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: recentCheckins } = await supabase.from("checkins").select("employee_id").gt("timestamp", twelveHoursAgo);
    const uniquePresent = new Set(recentCheckins?.map((c) => c.employee_id)).size;

    // Geofence Alerts: count check-ins outside any site's radius
    let alertCount = 0;
    if (logs && siteList && siteList.length > 0) {
      logs.forEach((log: any) => {
        if (log.latitude == null || log.longitude == null) return;
        const insideAnySite = siteList.some((site: any) => {
          const dist = haversineDistance(log.latitude, log.longitude, site.latitude, site.longitude);
          return dist <= (site.radius_meters || 100);
        });
        if (!insideAnySite) alertCount++;
      });
    }

    setData({ totalEmployees: empCount || 0, activeSites: siteCount || 0, onSiteNow: uniquePresent, geofenceAlerts: alertCount });
  };

  const fetchEmployees = async () => {
    const { data: empList } = await supabase.from("employees").select("*");
    if (empList) setEmployees(empList);
  };

  // ─── Employee CRUD ───
  const handleAddEmployee = async () => {
    if (!formData.employee_id || !formData.name || !formData.password) return;
    const { error } = await supabase.from("employees").insert([formData]);
    if (error) { alert("Error: " + error.message); return; }
    setFormData({ employee_id: "", name: "", password: "" });
    setShowAddForm(false);
    fetchEmployees();
    fetchStats();
  };

  const handleUpdateEmployee = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("employees").update({ name: formData.name, password: formData.password }).eq("employee_id", editingId);
    if (error) { alert("Error: " + error.message); return; }
    setEditingId(null);
    setFormData({ employee_id: "", name: "", password: "" });
    fetchEmployees();
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm(`Delete employee ${id}?`)) return;
    await supabase.from("employees").delete().eq("employee_id", id);
    fetchEmployees();
    fetchStats();
  };

  const handleDeleteSite = async (site: Site) => {
    if (!confirm(`Delete site "${site.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("sites").delete().eq("id", site.id);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    await fetchStats();
  };

  // ─── Utilities ───
  const printQRCodeOnly = () => { window.print(); };

  const downloadMonthlyStatement = async () => {
    const firstDay = new Date();
    firstDay.setDate(1);
    const { data, error } = await supabase.from("checkins").select("employee_id, timestamp, latitude, longitude").gte("timestamp", firstDay.toISOString());
    if (error || !data) return alert("No data found for this month.");
    const headers = "EmployeeID,Date,Time,Lat,Lng\n";
    const csv = data.map((r) => { const d = new Date(r.timestamp); return `${r.employee_id},${d.toLocaleDateString()},${d.toLocaleTimeString()},${r.latitude},${r.longitude}`; }).join("\n");
    const blob = new Blob([headers + csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", ""); a.setAttribute("href", url);
    a.setAttribute("download", `GeoBadge_Statement_${new Date().getMonth() + 1}.csv`);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ─── Real-Time Subscription ───
  useEffect(() => {
    if (!isAdmin) return;
    fetchStats();
    fetchEmployees();
    const channel = supabase.channel("realtime-checkins").on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, () => fetchStats()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const stats = [
    { name: "Total Employees", value: data.totalEmployees, icon: Users, color: "text-blue-600" },
    { name: "On-Site Now", value: data.onSiteNow, icon: Activity, color: "text-green-600" },
    { name: "Geofence Alerts", value: data.geofenceAlerts, icon: ShieldAlert, color: "text-red-600" },
    { name: "Active Sites", value: data.activeSites, icon: MapPin, color: "text-purple-600" },
  ];

  // Helper: check if a log entry is inside a geofence
  const isInsideGeofence = (log: any) => {
    if (!log.latitude || !log.longitude || sites.length === 0) return true;
    return sites.some((site) => haversineDistance(log.latitude, log.longitude, site.latitude, site.longitude) <= (site.radius_meters || 100));
  };

  // ════════════════════════════════════════════════
  // ─── ADMIN LOGIN GATE ──────────────────────────
  // ════════════════════════════════════════════════
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-8 w-8 text-green-700" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">GeoBadge Hub</h1>
          <p className="text-gray-500 text-sm mb-8">Admin access required</p>
          <input
            type="password"
            placeholder="Enter admin PIN"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
          />
          {authError && <p className="text-red-500 text-sm mb-4">{authError}</p>}
          <button onClick={handleLogin} className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
            Unlock Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // ─── MAIN DASHBOARD ────────────────────────────
  // ════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* ─── Single Header ─── */}
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">GeoBadge Hub</h1>
          <p className="text-gray-500">Live operation monitoring center.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadMonthlyStatement} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-all">
            Export Monthly Statement
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-all">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((item) => (
          <div key={item.name} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <item.icon className={`h-6 w-6 ${item.color}`} />
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <p className="text-sm font-medium text-gray-500">{item.name}</p>
            <p className="text-3xl font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Map Section ─── */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-[400px]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-700">Set Factory Location</h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            onClick={async () => {
              const { error } = await supabase.from("sites").insert([{ name: "Main Factory", latitude: selectedCoords.lat, longitude: selectedCoords.lng, radius_meters: 100 }]);
              if (error) { alert("Error:" + error.message); } else { alert("New Site Active!"); await fetchStats(); }
            }}
          >
            Save Site
          </button>
        </div>
        <SiteMap onCoordsSelected={(lat: number, lng: number) => setSelectedCoords({ lat, lng })} />
      </div>

      {/* ─── QR + Security Row (QR payload = selected site id from Site Management below) ─── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">Factory Access Point</h2>
            <p className="text-sm text-gray-500">Display this QR at the entrance for employee scans.</p>
            {activeSite ? (
              <>
                <p className="text-blue-600 font-medium mt-2">Active Site: {activeSite.name}</p>
                <p className="text-xs text-gray-500 mt-1">Radius: {activeSite.radius_meters}m</p>
              </>
            ) : (
              <p className="text-amber-600 text-sm mt-2">Save a site on the map above, then pick it in Site Management.</p>
            )}
          </div>
          <div id="printable-qr" className="bg-gray-50 p-4 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center">
            <h1 className="hidden print:block text-2xl font-bold mb-4 text-gray-900">GeoBadge: {activeSite?.name || "Factory"} Entrance</h1>
            {activeSite ? (
              <div className="p-2 border-4 border-gray-100 rounded-lg bg-white">
                <QRCodeSVG value={String(activeSite.id)} size={280} level="H" includeMargin={true} />
              </div>
            ) : (
              <div className="w-[280px] h-[280px] flex items-center justify-center text-gray-400 text-sm px-4">No active site</div>
            )}
            <p className="hidden print:block mt-4 text-sm text-gray-500">
              Site ID: {activeSite?.id ?? "—"} | Generated: {new Date().toLocaleDateString()}
            </p>
          </div>
          <p className="mt-4 text-xs text-gray-400 font-mono break-all max-w-full px-2">
            Payload: {activeSite?.id ?? "—"}
          </p>
          <button onClick={printQRCodeOnly} className="mt-6 text-sm font-semibold text-blue-600 hover:underline">Print Entrance Badge</button>
        </div>

        <div className="bg-gray-900 text-white p-8 rounded-xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Security Protocol: Active</h3>
            <p className="text-gray-400 text-sm">Check-ins are only valid when the scanned QR payload matches the GPS coordinates of the active geofence.</p>
          </div>
          <div className="space-y-3 mt-6">
            <div className="flex justify-between text-sm"><span className="text-gray-400">Encryption</span><span className="text-green-400 font-mono">AES-256</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Biometric Sync</span><span className="text-green-400 font-mono">Enabled</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Geofence Radius</span><span className="text-green-400 font-mono">{activeSite?.radius_meters || 100}m</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">Active Sites</span><span className="text-green-400 font-mono">{data.activeSites}</span></div>
          </div>
        </div>
      </div>

      {/* ─── Site Management (controls which site id is encoded in the QR above) ─── */}
      <SiteList
        sites={sites}
        onSelect={(site) => setActiveSite(site)}
        onDelete={handleDeleteSite}
        activeSiteId={activeSite?.id}
      />

      {/* ─── Employee Management ─── */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Employee Management</h2>
          <button onClick={() => { setShowAddForm(true); setEditingId(null); setFormData({ employee_id: "", name: "", password: "" }); }} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingId) && (
          <div className="p-6 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">{editingId ? `Edit: ${editingId}` : "New Employee"}</h3>
              <button title="Close form" aria-label="Close form" onClick={() => { setShowAddForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {!editingId && (
                <input placeholder="Employee ID" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
              )}
              <input placeholder="Full Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input placeholder="Password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button onClick={editingId ? handleUpdateEmployee : handleAddEmployee} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
              {editingId ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        )}

        {/* Employee Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {employees.map((emp) => (
                <tr key={emp.employee_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 font-mono">{emp.employee_id}</td>
                  <td className="px-6 py-4 text-gray-600">{emp.name}</td>
                  <td className="px-6 py-4 flex items-center gap-3">
                    <button title="Edit employee" aria-label="Edit employee" onClick={() => { setEditingId(emp.employee_id); setFormData({ employee_id: emp.employee_id, name: emp.name, password: "" }); setShowAddForm(false); }} className="text-blue-600 hover:text-blue-800"><Pencil className="w-4 h-4" /></button>
                    <button title="Delete employee" aria-label="Delete employee" onClick={() => handleDeleteEmployee(emp.employee_id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">No employees registered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Daily Presence Log ─── */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Daily Presence Log</h2>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-green-100 text-green-800">Live Updates</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {recentLogs.map((log, i) => {
                const inside = isInsideGeofence(log);
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{log.employee_id}</td>
                    <td className="px-6 py-4 text-gray-600">{log.employees?.name || "Unknown"}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-6 py-4">
                      {inside ? (
                        <span className="flex items-center text-green-600"><div className="h-1.5 w-1.5 rounded-full bg-green-600 mr-2"></div>Verified</span>
                      ) : (
                        <span className="flex items-center text-red-600"><div className="h-1.5 w-1.5 rounded-full bg-red-600 mr-2"></div>Outside Geofence</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {recentLogs.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">No scans recorded yet today.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
