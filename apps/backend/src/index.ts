import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { businessRouter } from "./routes/business";
import { customerRouter } from "./routes/customer";

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for cross-origin requests from frontend worker apps
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Mount routes
app.route("/health", healthRouter);
app.route("/api/auth", authRouter);
app.route("/api/business", businessRouter);
app.route("/api/customer", customerRouter);

// Root fallback
app.get("/", (c) => {
  return c.json({
    name: "ai-campaign-builder-backend",
    version: "0.1.0",
    docs: "See architecture.md and plan.md at repo root",
  });
});

export default app;
