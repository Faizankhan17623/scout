import ImageSlider from "./ImageSlider";

function Message({ role, content, searches = [] }) {
  const totalResults = searches.reduce((n, s) => n + (s.results?.length || 0), 0);
  const images = searches.flatMap((s) => s.images || []);

  return (
    <div className="message" data-role={role}>
      <div className="message-role">{role === "user" ? "You" : "Scout"}</div>
      <div className="message-bubble">
        <p className="message-text">{content}</p>

        {images.length > 0 && <ImageSlider images={images} />}

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
