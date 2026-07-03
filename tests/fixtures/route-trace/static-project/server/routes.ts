export function registerRoutes(app) {
  app.get("/health", () => ({ ok: true }));
  app.post("/api/widgets", () => ({ ok: true }));
}
