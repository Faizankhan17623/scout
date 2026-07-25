import { useState } from "react";
import ImageSlider from "./ImageSlider";
import { speakText } from "./api";

function WeatherCard({ data }) {
  return (
    <div className="tool-card" data-kind="weather">
      <div className="tool-card-heading">{data.location}</div>
      <div className="tool-card-current">
        <span className="tool-card-temp">{Math.round(data.current.temperatureC)}°C</span>
        <span className="tool-card-condition">{data.current.condition}</span>
      </div>
      <div className="tool-card-daily">
        {data.daily.map((day) => (
          <div key={day.date} className="tool-card-day">
            <span>{day.date.slice(5)}</span>
            <span>{Math.round(day.maxTemperatureC)}° / {Math.round(day.minTemperatureC)}°</span>
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

function ToolCallCard({ call }) {
  if (call.kind === "weather") return <WeatherCard data={call.data} />;
  if (call.kind === "wikipedia") return <WikipediaCard data={call.data} />;
  if (call.kind === "read_page") return <ReadPageCard data={call.data} />;
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

function Message({ role, content, searches = [], toolCalls = [] }) {
  const totalResults = searches.reduce((n, s) => n + (s.results?.length || 0), 0);
  const searchImages = searches.flatMap((s) => s.images || []);
  const toolImages = toolCalls.flatMap((c) => c.images || []);
  const images = [...searchImages, ...toolImages];
  const cardCalls = toolCalls.filter((c) => c.kind === "weather" || c.kind === "wikipedia" || c.kind === "read_page");

  return (
    <div className="message" data-role={role}>
      <div className="message-role">{role === "user" ? "You" : "Scout"}</div>
      <div className="message-bubble">
        <p className="message-text">{content}</p>

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
      </div>
    </div>
  );
}

export default Message;
