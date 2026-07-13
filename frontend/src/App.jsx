import { useState, useRef, useEffect } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [searches, setSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [prompt]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError("");
    setResponse("");
    setSearches([]);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResponse(data.response);
      setSearches(data.searches || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  }

  const totalResults = searches.reduce((n, s) => n + (s.results?.length || 0), 0);

  return (
    <div className="page">
      <div className="rail" aria-hidden="true" />

      <div className="container">
        <header className="masthead">
          <div className="mark">
            <span className="mark-dot" data-live={loading} />
            <span className="mark-text">SCOUT</span>
          </div>
          <p className="tagline">web search agent · live trace</p>
        </header>

        <form onSubmit={handleSubmit} className="prompt-form">
          <label htmlFor="prompt-input" className="field-label">
            Query
          </label>
          <textarea
            id="prompt-input"
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something that needs a current answer…"
            rows={1}
            disabled={loading}
          />
          <div className="form-row">
            <span className="hint">⌘/Ctrl + Enter to send</span>
            <button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Running
                </>
              ) : (
                "Run query →"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="error" role="alert">
            <span className="error-glyph">!</span>
            {error}
          </div>
        )}

        {response && (
          <section className="result">
            <div className="result-header">
              <span className="result-label">Response</span>
              {searches.length > 0 && (
                <span className="result-meta">
                  {searches.length} search{searches.length !== 1 ? "es" : ""} · {totalResults} source
                  {totalResults !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="response-text">{response}</p>

            {searches.length > 0 && (
              <div className="trace">
                <div className="trace-heading">Search trace</div>
                <ol className="trace-list">
                  {searches.map((s, i) => (
                    <li key={i} className="trace-item">
                      <div className="trace-query">
                        <span className="trace-glyph">↗</span>
                        {s.query}
                      </div>
                      <ul className="trace-results">
                        {(s.results || []).map((r, j) => (
                          <li key={j}>
                            <a href={r.url} target="_blank" rel="noreferrer">
                              {r.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
