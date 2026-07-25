import { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "./Sidebar";
import Message from "./Message";
import {
  listConversations,
  getConversation,
  deleteConversation,
  createConversationStream,
  addMessageStream,
  transcribeAudio,
} from "./api";
import "./App.css";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 272;

function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = Number(localStorage.getItem("scout-sidebar-width"));
    if (stored && stored >= SIDEBAR_MIN_WIDTH && stored <= SIDEBAR_MAX_WIDTH) {
      return stored;
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });
  const [resizing, setResizing] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("scout-theme") || "system");

  const textareaRef = useRef(null);
  const threadEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data.conversations);
    } catch {
      // sidebar list failing silently is acceptable; the composer still works
    }
  }, []);

  useEffect(() => {
    refreshConversations()
      .catch(() => {})
      .finally(() => setAppReady(true));
  }, [refreshConversations]);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("scout-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("scout-theme", theme);
    }
  }, [theme]);

  function cycleTheme() {
    setTheme((prev) => (prev === "system" ? "light" : prev === "light" ? "dark" : "system"));
  }

  useEffect(() => {
    if (!appReady) return;
    const timer = setTimeout(() => setSplashVisible(false), 350);
    return () => clearTimeout(timer);
  }, [appReady]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    function clientXOf(evt) {
      return evt.touches ? evt.touches[0].clientX : evt.clientX;
    }

    function handleMove(evt) {
      const next = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, clientXOf(evt))
      );
      setSidebarWidth(next);
    }

    function handleEnd() {
      setResizing(false);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [resizing]);

  useEffect(() => {
    if (resizing) return;
    localStorage.setItem("scout-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth, resizing]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [draft]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function closeSidebarOnMobile() {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setSidebarCollapsed(true);
    }
  }

  async function handleSelect(id) {
    setError("");
    setActiveId(id);
    closeSidebarOnMobile();
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
    closeSidebarOnMobile();
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
    setStreamingText("");
    setMessages((prev) => [...prev, { role: "user", content: text, searches: [] }]);

    const onToken = (token) => setStreamingText((prev) => prev + token);

    try {
      const conversation = activeId
        ? await addMessageStream(activeId, text, onToken)
        : await createConversationStream(text, onToken);

      setMessages(conversation.messages || []);
      if (!activeId) {
        setActiveId(conversation._id);
      }
      refreshConversations();
    } catch (err) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
      setDraft(text);
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  async function handleMicClick() {
    setVoiceError("");

    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Voice input isn't supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          setDraft((prev) => (prev ? `${prev} ${text}` : text).trim());
          textareaRef.current?.focus();
        } catch (err) {
          setVoiceError(err.message);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setVoiceError("Microphone access was denied");
    }
  }

  return (
    <div className={`app${resizing ? " app-resizing" : ""}`}>
      <div className={`splash${splashVisible ? "" : " splash-hidden"}`} aria-hidden={!splashVisible}>
        <div className="splash-mark">
          <span className="splash-dot" />
          <span className="splash-text">SCOUT</span>
        </div>
        <span className="spinner splash-spinner" />
      </div>

      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNewChat={handleNewChat}
        onDelete={handleDelete}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
        loading={loading}
        width={sidebarWidth}
        onResizeStart={handleResizeStart}
        theme={theme}
        onCycleTheme={cycleTheme}
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
                <Message
                  key={m._id || i}
                  role={m.role}
                  content={m.content}
                  searches={m.searches}
                  toolCalls={m.toolCalls}
                />
              ))}
              {loading && (
                <div className="message" data-role="assistant">
                  <div className="message-role">Scout</div>
                  <div className="message-bubble">
                    {streamingText ? (
                      <p className="message-text">
                        {streamingText}
                        <span className="stream-caret" />
                      </p>
                    ) : (
                      <div className="thinking">
                        <span className="spinner" />
                        Thinking
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>
          </div>
        )}

        <div className="composer-bar">
          {error && (
            <div className="error" role="alert">
              <span className="error-glyph">!</span>
              {error}
            </div>
          )}
          {voiceError && (
            <div className="error" role="alert">
              <span className="error-glyph">!</span>
              {voiceError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="composer">
            <button
              type="button"
              className="mic-button"
              data-recording={recording}
              onClick={handleMicClick}
              disabled={loading || transcribing}
              aria-label={recording ? "Stop recording" : "Record voice message"}
              aria-pressed={recording}
            >
              {transcribing ? (
                <span className="spinner" />
              ) : (
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <rect x="7" y="2" width="6" height="10" rx="3" fill="currentColor" />
                  <path
                    d="M4 9.5a6 6 0 0 0 12 0M10 15.5v2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={recording ? "Listening…" : "Ask Scout something…"}
              rows={1}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message">
              {loading ? <span className="spinner" /> : "↑"}
            </button>
          </form>
          <p className="composer-hint">Enter to send · Shift+Enter for a new line</p>
        </div>
      </main>
    </div>
  );
}

export default App;
