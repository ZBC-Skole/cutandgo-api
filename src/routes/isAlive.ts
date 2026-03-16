import { Hono } from "hono";
import type { Context } from "hono";

const isAlive = new Hono().get("/", (c: Context) =>
  c.json({ message: "I'm alive!" }),
);

export default isAlive;
