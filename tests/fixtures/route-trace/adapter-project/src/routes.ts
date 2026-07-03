export function register(app) {
  app.get("/adapter-health", () => ({ ok: true }));
}
