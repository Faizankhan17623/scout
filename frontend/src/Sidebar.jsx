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
      <div className="sidebar-inner" inert={collapsed}>
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
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <rect x="2.5" y="3.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <line x1="7.8" y1="3.5" x2="7.8" y2="16.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <button type="button" className="nav-row" onClick={onNewChat} tabIndex={collapsed ? -1 : 0}>
            <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 4v12M4 10h12"
              />
            </svg>
            New chat
          </button>
        </nav>

        <div className="conversation-section-label">Chats</div>

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
