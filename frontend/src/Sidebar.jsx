function formatWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Sidebar({ conversations, activeId, onSelect, onNewChat, collapsed, onToggle }) {
  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="sidebar-top">
        <div className="mark">
          <span className="mark-text">SCOUT</span>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <button type="button" className="new-chat" onClick={onNewChat}>
        <span className="new-chat-glyph">+</span>
        New chat
      </button>

      <nav className="conversation-list" aria-label="Conversation history">
        {conversations.length === 0 && (
          <p className="conversation-empty">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <button
            key={c._id}
            type="button"
            className="conversation-item"
            data-active={c._id === activeId}
            onClick={() => onSelect(c._id)}
          >
            <span className="conversation-title">{c.title || "Untitled"}</span>
            <span className="conversation-time">{formatWhen(c.updatedAt)}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
