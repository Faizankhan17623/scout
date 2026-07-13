import { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "./Sidebar";
import Message from "./Message";
import {
  listConversations,
  getConversation,
  createConversation,
  addMessage,
  deleteConversation,
} from "./api";
import "./App.css";

function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const textareaRef = useRef(null);
  const threadEndRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data.conversations);
    } catch {
      // sidebar list failing silently is acceptable; the composer still works
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [draft]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSelect(id) {
    setError("");
    setActiveId(id);
    try {
      const data = await getConversation(id);
      setMessages(data.conversation.messages || []);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleNewChat() {
    setActiveId(null);
    setMessages([]);
    setError("");
    setDraft("");
    textareaRef.current?.focus();
  }

  async function handleDelete(id) {
    const previous = conversations;
    setConversations((prev) => prev.filter((c) => c._id !== id));

    if (id === activeId) {
      handleNewChat();
    }

    try {
      await deleteConversation(id);
    } catch (err) {
      setConversations(previous);
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    setDraft("");
    setError("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text, searches: [] }]);

    try {
      const data = activeId
        ? await addMessage(activeId, text)
        : await createConversation(text);

      setMessages(data.conversation.messages || []);
      if (!activeId) {
        setActiveId(data.conversation._id);
      }
      refreshConversations();
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
      setDraft(text);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        loading={loading}
      />

      <main className="chat-pane">
        {sidebarCollapsed && (
          <button
            type="button"
            className="sidebar-reopen"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
          >
            »
          </button>
        )}

        {messages.length === 0 ? (
          <div className="empty-state">
            <h1>What do you want to know?</h1>
            <p>Scout reaches out to the live web when your question needs a current answer.</p>
          </div>
        ) : (
          <div className="thread">
            <div className="thread-inner">
              {messages.map((m, i) => (
                <Message key={m._id || i} role={m.role} content={m.content} searches={m.searches} />
              ))}
              {loading && (
                <div className="message" data-role="assistant">
                  <div className="message-role">Scout</div>
                  <div className="message-bubble">
                    <div className="thinking">
                      <span className="spinner" />
                      Thinking
                    </div>
                  </div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>
          </div>
        )}

        {error && (
          <div className="error" role="alert">
            <span className="error-glyph">!</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="composer">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Scout something…"
            rows={1}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message">
            {loading ? <span className="spinner" /> : "↑"}
          </button>
        </form>
        <p className="composer-hint">Enter to send · Shift+Enter for a new line</p>
      </main>
    </div>
  );
}

export default App;
