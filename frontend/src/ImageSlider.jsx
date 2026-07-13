import { useRef, useState } from "react";

function ImageSlider({ images }) {
  const trackRef = useRef(null);
  const [broken, setBroken] = useState({});

  const visible = images.filter((img) => !broken[img.url]);
  if (visible.length === 0) return null;

  function scrollBy(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="image-slider">
      <div className="image-slider-track" ref={trackRef}>
        {visible.map((img, i) => (
          <a
            key={img.url}
            className="image-slide"
            href={img.url}
            target="_blank"
            rel="noreferrer"
            title={img.description || undefined}
          >
            <img
              src={img.url}
              alt={img.description || `Related image ${i + 1}`}
              loading="lazy"
              onError={() => setBroken((prev) => ({ ...prev, [img.url]: true }))}
            />
          </a>
        ))}
      </div>
      {visible.length > 1 && (
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
