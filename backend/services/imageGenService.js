const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

function generateImage(prompt, { width = 1024, height = 1024 } = {}) {
  const url = `${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=flux&nologo=true&seed=${Date.now()}`;
  return { url, prompt };
}

module.exports = { generateImage };
