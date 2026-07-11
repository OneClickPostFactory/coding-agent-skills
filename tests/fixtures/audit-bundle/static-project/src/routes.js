export function registerRoutes(app) {
  app.get("/api/health", (_request, response) => response.json({ ok: true }));
}

export async function loadSummary() {
  return fetch("/api/summary");
}
