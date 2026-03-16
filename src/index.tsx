import { Hono } from "hono";
import { renderer } from "./renderer";
import isAlive from "./routes/isAlive";

const api = new Hono().basePath("/api/v1");

api.use(renderer);

api.route("/is-alive", isAlive);

export default api;
