import { useEffect, useRef, useState } from "react";

const MAX_RETRIES = 2;

function filenameFor(img, i) {
  const base = (img.description || `scout-image-${i + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || `scout-image-${i + 1}`}.jpg`;
}

function Lightbox({ image, index, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filenameFor(image, index);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(image.url, "_blank", "noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={image.url} alt={image.description || "Generated image"} />
        <div className="lightbox-controls">
          <button type="button" className="lightbox-button" onClick={handleDownload} disabled={downloading}>
            {downloading ? <span className="spinner" /> : "Download"}
          </button>
          <button type="button" className="lightbox-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageSlider({ images }) {
  const trackRef = useRef(null);
  const [failed, setFailed] = useState({});
  const [loaded, setLoaded] = useState({});
  const [retryCount, setRetryCount] = useState({});
  const [openIndex, setOpenIndex] = useState(null);

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
                  <button
                    type="button"
                    className="image-slide-open"
                    onClick={() => setOpenIndex(i)}
                    title={img.description || undefined}
                    disabled={!loaded[img.url]}
                  >
                    <img
                      src={src}
                      alt={img.description || `Related image ${i + 1}`}
                      loading="lazy"
                      onLoad={() => setLoaded((prev) => ({ ...prev, [img.url]: true }))}
                      onError={() => handleError(img.url)}
                    />
                  </button>
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
      {openIndex !== null && (
        <Lightbox image={images[openIndex]} index={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </div>
  );
}

export default ImageSlider;
