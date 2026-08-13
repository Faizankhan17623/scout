import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import ImageSlider from "./ImageSlider";
import { speakText } from "./api";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className="code-copy-button" onClick={handleCopy}>
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M3 8.5 6.5 12 13 4.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path fill="none" stroke="currentColor" strokeWidth="1.3" d="M3 10.5V3.8A1.3 1.3 0 0 1 4.3 2.5h6.7" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function CodeBlock({ className, children }) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match?.[1] || "text";
  const code = String(children).replace(/\n$/, "");
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language}
        style={prefersDark ? oneDark : oneLight}
        customStyle={{ margin: 0, borderRadius: 0, background: "transparent" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

const markdownComponents = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  code: ({ node: _node, inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
};

function WeatherIcon({ icon, size = 22 }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };

  if (icon === "sunny") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <g {...stroke}>
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.4" y1="4.4" x2="6.1" y2="6.1" />
          <line x1="17.9" y1="17.9" x2="19.6" y2="19.6" />
          <line x1="4.4" y1="19.6" x2="6.1" y2="17.9" />
          <line x1="17.9" y1="6.1" x2="19.6" y2="4.4" />
        </g>
      </svg>
    );
  }
  if (icon === "partly-cloudy") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle cx="9" cy="9" r="3.6" fill="currentColor" opacity="0.85" />
        <path {...stroke} d="M7 20h9.5a3.8 3.8 0 0 0 .7-7.55A5.2 5.2 0 0 0 7.3 14" />
      </svg>
    );
  }
  if (icon === "rainy") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...stroke} d="M6.5 15.5h11a3.8 3.8 0 0 0 .7-7.55A5.6 5.6 0 0 0 7.4 9.7a4 4 0 0 0-.9 5.8Z" />
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <line x1="8.5" y1="18.5" x2="7.5" y2="21" />
          <line x1="12.5" y1="18.5" x2="11.5" y2="21" />
          <line x1="16.5" y1="18.5" x2="15.5" y2="21" />
        </g>
      </svg>
    );
  }
  if (icon === "snowy") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...stroke} d="M6.5 14.5h11a3.8 3.8 0 0 0 .7-7.55A5.6 5.6 0 0 0 7.4 8.7a4 4 0 0 0-.9 5.8Z" />
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <line x1="8.5" y1="18" x2="8.5" y2="21.5" />
          <line x1="8.5" y1="18" x2="7" y2="19" />
          <line x1="8.5" y1="18" x2="10" y2="19" />
          <line x1="15.5" y1="18" x2="15.5" y2="21.5" />
          <line x1="15.5" y1="18" x2="14" y2="19" />
          <line x1="15.5" y1="18" x2="17" y2="19" />
        </g>
      </svg>
    );
  }
  if (icon === "stormy") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...stroke} d="M6.5 13.5h11a3.8 3.8 0 0 0 .7-7.55A5.6 5.6 0 0 0 7.4 7.7a4 4 0 0 0-.9 5.8Z" />
        <path fill="currentColor" d="m13 15-3 5h2.4l-1.2 4 4.3-6h-2.4l1.2-3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path {...stroke} d="M6.5 16.5h11a3.8 3.8 0 0 0 .7-7.55A5.6 5.6 0 0 0 7.4 10.7a4 4 0 0 0-.9 5.8Z" />
    </svg>
  );
}

function WeatherCard({ data }) {
  return (
    <div className="weather-card">
      <div className="weather-card-top">
        <div>
          <div className="weather-card-location">{data.location}</div>
          <div className="weather-card-condition">{data.current.condition}</div>
        </div>
        <div className="weather-card-icon">
          <WeatherIcon icon={data.current.icon} size={34} />
        </div>
      </div>

      <div className="weather-card-temp">{Math.round(data.current.temperatureC)}°</div>

      <div className="weather-card-meta">
        <span>💧 {data.current.humidityPercent}%</span>
        <span>💨 {Math.round(data.current.windSpeedKmh)} km/h</span>
      </div>

      <div className="weather-card-forecast">
        {data.daily.map((day) => (
          <div key={day.date} className="weather-card-forecast-day">
            <span className="weather-card-forecast-label">
              {new Date(day.date).toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <WeatherIcon icon={day.icon} size={20} />
            <span className="weather-card-forecast-temps">
              <strong>{Math.round(day.maxTemperatureC)}°</strong> {Math.round(day.minTemperatureC)}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WikipediaCard({ data }) {
  return (
    <a className="tool-card" data-kind="wikipedia" href={data.url} target="_blank" rel="noreferrer">
      <div className="tool-card-heading">{data.title}</div>
      <p className="tool-card-extract">{data.extract}</p>
    </a>
  );
}

function ReadPageCard({ data }) {
  return (
    <a className="tool-card" data-kind="read-page" href={data.url} target="_blank" rel="noreferrer">
      <div className="tool-card-heading">{data.title || data.url}</div>
      <p className="tool-card-extract">{(data.content || "").slice(0, 240)}…</p>
    </a>
  );
}

function GithubRepoCard({ data }) {
  const summary = data.description || (data.readme ? "See README" : "No README — summarized from source");
  const meta = [data.language, `★ ${data.stars}`].filter(Boolean).join(" · ");
  return (
    <a className="tool-card" data-kind="github-repo" href={data.url} target="_blank" rel="noreferrer">
      <div className="tool-card-heading">
        {data.owner}/{data.repo}
      </div>
      <p className="tool-card-extract">
        {summary}
        {meta ? ` · ${meta}` : ""}
      </p>
    </a>
  );
}

function CodeExecCard({ data }) {
  const failed = data.exitCode !== 0 && data.exitCode !== null;
  return (
    <div className="tool-card code-exec-card" data-kind="code-exec">
      <CodeBlock className={`language-${data.language}`}>{data.code}</CodeBlock>
      {(data.stdout || data.stderr) && (
        <div className="code-exec-output" data-failed={failed || undefined}>
          <div className="code-exec-output-label">{failed ? "Error" : "Output"}</div>
          <pre>{data.stderr || data.stdout}</pre>
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ call }) {
  if (call.kind === "weather") return <WeatherCard data={call.data} />;
  if (call.kind === "wikipedia") return <WikipediaCard data={call.data} />;
  if (call.kind === "read_page") return <ReadPageCard data={call.data} />;
  if (call.kind === "github_repo") return <GithubRepoCard data={call.data} />;
  if (call.kind === "code_exec") return <CodeExecCard data={call.data} />;
  return null;
}

function ListenButton({ text }) {
  const [state, setState] = useState("idle");

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    try {
      const blob = await speakText(text);
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setState("idle");
      audio.play();
      setState("playing");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      className="listen-button"
      onClick={handleClick}
      disabled={state === "loading"}
      aria-label="Listen to this message"
    >
      {state === "loading" ? (
        <span className="spinner" />
      ) : state === "error" ? (
        "Voice unavailable"
      ) : (
        <>
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path
              d="M4 7.5v5h3l4.5 3.5v-12L7 7.5H4Z"
              fill="currentColor"
            />
            <path
              d="M14 7a4 4 0 0 1 0 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Listen
        </>
      )}
    </button>
  );
}

function EditableUserMessage({ content, onSave, onCancel }) {
  const [value, setValue] = useState(content);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSave(value.trim());
    } else if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div className="message-edit">
      <textarea
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }
        }}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />
      <div className="message-edit-actions">
        <button type="button" className="message-edit-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="message-edit-save"
          disabled={!value.trim()}
          onClick={() => onSave(value.trim())}
        >
          Save &amp; submit
        </button>
      </div>
    </div>
  );
}

function Message({
  role,
  content,
  searches = [],
  toolCalls = [],
  followUps = [],
  attachedFileName,
  onEdit,
  onFollowUpClick,
}) {
  const [editing, setEditing] = useState(false);
  const totalResults = searches.reduce((n, s) => n + (s.results?.length || 0), 0);
  const searchImages = searches.flatMap((s) => s.images || []);
  const toolImages = toolCalls.flatMap((c) => c.images || []);
  const images = [...searchImages, ...toolImages];
  const cardCalls = toolCalls.filter(
    (c) =>
      c.kind === "weather" ||
      c.kind === "wikipedia" ||
      c.kind === "read_page" ||
      c.kind === "github_repo" ||
      c.kind === "code_exec"
  );

  if (role === "user" && editing) {
    return (
      <div className="message" data-role={role}>
        <div className="message-role">You</div>
        <div className="message-bubble message-bubble-editing">
          <EditableUserMessage
            content={content}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              onEdit(text);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="message" data-role={role}>
      <div className="message-role">{role === "user" ? "You" : "Scout"}</div>
      <div className="message-bubble">
        {role === "user" && attachedFileName && (
          <div className="message-attachment">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
              />
            </svg>
            {attachedFileName}
          </div>
        )}

        {role === "assistant" ? (
          <div className="message-text message-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="message-text">{content}</p>
        )}

        {role === "user" && onEdit && (
          <button type="button" className="message-edit-trigger" onClick={() => setEditing(true)} aria-label="Edit message">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                fill="currentColor"
                d="M11.3 1.3a1 1 0 0 1 1.4 0l2 2a1 1 0 0 1 0 1.4l-7.6 7.6-3.4.9.9-3.4 6.7-6.7Zm1 2.1-1-1-6 6-.4 1.5 1.5-.4 6-6Z"
              />
            </svg>
            Edit
          </button>
        )}

        {images.length > 0 && <ImageSlider images={images} />}

        {cardCalls.length > 0 && (
          <div className="tool-cards">
            {cardCalls.map((call, i) => (
              <ToolCallCard key={i} call={call} />
            ))}
          </div>
        )}

        {role === "assistant" && content && <ListenButton text={content} />}

        {searches.length > 0 && (
          <div className="trace">
            <div className="trace-heading">
              Search trace · {searches.length} search{searches.length !== 1 ? "es" : ""} ·{" "}
              {totalResults} source{totalResults !== 1 ? "s" : ""}
            </div>
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

        {role === "assistant" && followUps.length > 0 && onFollowUpClick && (
          <div className="follow-ups">
            {followUps.map((q, i) => (
              <button type="button" key={i} className="follow-up-chip" onClick={() => onFollowUpClick(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Message;
