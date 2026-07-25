import { useRef, useState } from "react";

const MAX_RETRIES = 2;

function ImageSlider({ images }) {
  const trackRef = useRef(null);
  const [failed, setFailed] = useState({});
  const [loaded, setLoaded] = useState({});
  const [retryCount, setRetryCount] = useState({});

  if (images.length === 0) return null;

  function scrollBy(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  function handleError(url) {
    setRetryCount((prev) => {
      const count = (prev[url] || 0) + 1;
      if (count > MAX_RETRIES) {
        setFailed((f) => ({ ...f, [url]: true }));
      }
      return { ...prev, [url]: count };
    });
  }

  function retry(url) {
    setFailed((prev) => ({ ...prev, [url]: false }));
    setRetryCount((prev) => ({ ...prev, [url]: 0 }));
  }

  return (
    <div className="image-slider">
      <div className="image-slider-track" ref={trackRef}>
        {images.map((img, i) => {
          const retries = retryCount[img.url] || 0;
          // A fresh cache-busting param per attempt forces the browser to
          // re-request instead of replaying a cached failure.
          const src = retries > 0 ? `${img.url}${img.url.includes("?") ? "&" : "?"}retry=${retries}` : img.url;

          return (
            <div key={img.url} className="image-slide" data-loaded={!!loaded[img.url]}>
              {failed[img.url] ? (
                <button type="button" className="image-slide-retry" onClick={() => retry(img.url)}>
                  Couldn't load — retry
                </button>
              ) : (
                <>
                  {!loaded[img.url] && (
                    <div className="image-slide-loading">
                      <span className="spinner" />
                    </div>
                  )}
                  <a href={img.url} target="_blank" rel="noreferrer" title={img.description || undefined}>
                    <img
                      src={src}
                      alt={img.description || `Related image ${i + 1}`}
                      loading="lazy"
                      onLoad={() => setLoaded((prev) => ({ ...prev, [img.url]: true }))}
                      onError={() => handleError(img.url)}
                    />
                  </a>
                </>
              )}
            </div>
          );
        })}
      </div>
      {images.length > 1 && (
        <div className="image-slider-controls">
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Scroll images left">
            ‹
          </button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="Scroll images right">
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export default ImageSlider;
