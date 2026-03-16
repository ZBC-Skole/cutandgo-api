import { Hono } from "hono";
import { renderer } from "./renderer";
import isAlive from "./routes/isAlive";
import users from "./routes/users";
import salons from "./routes/salons";
import bookings from "./routes/bookings";
import admin from "./routes/admin";
import staff from "./routes/staff";
import type { AppBindings } from "./lib/convex";

const api = new Hono<{ Bindings: AppBindings }>().basePath("/api/v1");

api.use(renderer);

api.route("/is-alive", isAlive);
api.route("/users", users);
api.route("/salons", salons);
api.route("/bookings", bookings);
api.route("/admin", admin);
api.route("/staff", staff);

export default api;
