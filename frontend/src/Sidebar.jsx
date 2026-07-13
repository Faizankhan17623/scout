function formatWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  collapsed,
  onToggle,
  loading,
}) {
  function handleDelete(e, id) {
    e.stopPropagation();
    onDelete(id);
  }

  return (
    <aside className="sidebar" data-collapsed={collapsed} aria-hidden={collapsed}>
      <div className="sidebar-inner" inert={collapsed ? "" : undefined}>
        <div className="sidebar-top">
          <div className="mark">
            <span className="mark-dot" data-live={loading} />
            <span className="mark-text">SCOUT</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            tabIndex={collapsed ? -1 : 0}
          >
            «
          </button>
        </div>

        <button
          type="button"
          className="new-chat"
          onClick={onNewChat}
          tabIndex={collapsed ? -1 : 0}
        >
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
              tabIndex={collapsed ? -1 : 0}
            >
              <span className="conversation-title">{c.title || "Untitled"}</span>
              <span className="conversation-time">{formatWhen(c.updatedAt)}</span>
              <span
                className="conversation-delete"
                role="button"
                tabIndex={collapsed ? -1 : 0}
                aria-label="Delete conversation"
                onClick={(e) => handleDelete(e, c._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDelete(e, c._id);
                  }
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M6 2h4a1 1 0 0 1 1 1v1h3v1.4H2V4h3V3a1 1 0 0 1 1-1Zm-1.5 4h7l-.55 7.15A1 1 0 0 1 10 14H6a1 1 0 0 1-.95-.85L4.5 6Z"
                  />
                </svg>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
