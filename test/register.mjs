// Loaded with `node --import ./test/register.mjs --test` (see package.json).
// The app's lib/ files are ES modules in .js files with no "type": "module",
// import each other through Next's "@/" alias and import JSON without
// attributes. Next's bundler handles all of that; plain Node needs this small
// hook instead, so tests can import the real files unchanged.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);

// lib/db.js builds its pool at import time and complains loudly without a
// connection string. Unit tests never query, so any well-formed one will do.
process.env.DATABASE_URL ||= "postgres://test:test@localhost:5432/unit-tests?sslmode=disable";
