const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

// "turbo" responds in under a second on the free/anonymous tier; "flux"
// produces slightly higher quality but routinely takes 25-45s to generate,
// which reads as a broken image in the UI. Favor turbo for responsiveness.
//
// seed must fit in a signed 32-bit int (<=2147483647) or Pollinations
// rejects the request with a 500 — Date.now() is 13 digits and always
// exceeds that, so every generated image silently failed until this was
// capped with modulo.
function generateImage(prompt, { width = 1024, height = 1024, model = "turbo" } = {}) {
  const seed = Date.now() % 2147483647;
  const url = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}`;
  return { url, prompt };
}

module.exports = { generateImage };
