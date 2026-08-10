import { useEffect, useState } from "react";
import { getSummary, getVisits, getActivity, clearAdminToken } from "./adminApi";

const STAT_LABELS = {
  totalUsers: "Users",
  totalConversations: "Conversations",
  totalMessages: "Messages",
  totalVisits: "Visits",
  uniqueIps: "Unique IPs",
};

export default function AdminDashboard({ onLogout }) {
  const [summary, setSummary] = useState(null);
  const [visits, setVisits] = useState(null);
  const [activity, setActivity] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  function handleError(err) {
    setError(err.message);
    if (err.message === "Unauthorized") onLogout();
  }

  useEffect(() => {
    getSummary().then(setSummary).catch(handleError);
    getActivity(14).then((d) => setActivity(d.activity)).catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getVisits(page, 50).then(setVisits).catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleLogout() {
    clearAdminToken();
    onLogout();
  }

  const totalPages = visits ? Math.max(1, Math.ceil(visits.total / visits.limit)) : 1;

  return (
    <div className="admin-root">
      <div className="admin-header">
        <h1>Scout admin</h1>
        <button className="admin-logout" onClick={handleLogout}>
          Log out
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {summary ? (
        <div className="admin-stats">
          {Object.entries(STAT_LABELS).map(([key, label]) => (
            <div className="admin-stat-card" key={key}>
              <div className="value">{summary[key] ?? 0}</div>
              <div className="label">{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="admin-loading">Loading summary…</div>
      )}

      <div className="admin-section">
        <h2>Activity (last 14 days)</h2>
        {activity && activity.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Conversations</th>
                <th>Messages</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{row.conversations}</td>
                  <td>{row.messages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-loading">No activity yet.</div>
        )}
      </div>

      <div className="admin-section">
        <h2>Recent visits</h2>
        {visits && visits.visits.length > 0 ? (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP</th>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Session</th>
                </tr>
              </thead>
              <tbody>
                {visits.visits.map((v) => (
                  <tr key={v._id}>
                    <td>{new Date(v.createdAt).toLocaleString()}</td>
                    <td>{v.ip || "—"}</td>
                    <td>{v.method}</td>
                    <td>{v.path}</td>
                    <td>{v.sessionToken ? `${v.sessionToken.slice(0, 8)}…` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="admin-loading">No visits logged yet.</div>
        )}
      </div>
    </div>
  );
}
