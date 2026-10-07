// Resolve/load hooks for the unit tests (registered by register.mjs).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inApp = (url) => url.startsWith("file:") && !url.includes("/node_modules/") && fileURLToPath(url).startsWith(ROOT + path.sep);

/* "@/lib/db" -> <repo>/lib/db.js; "./db" -> ./db.js (Next allows both without
   an extension). */
export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
  const relative = spec.startsWith("./") || spec.startsWith("../");
  if ((spec !== specifier || relative) && !path.extname(spec)) {
    const base = spec.startsWith("file:") ? fileURLToPath(spec) : path.resolve(path.dirname(fileURLToPath(context.parentURL)), spec);
    if (existsSync(base + ".js")) spec = pathToFileURL(base + ".js").href;
  }
  let resolved;
  try {
    resolved = await next(spec, context);
  } catch (e) {
    // "next/headers": a package file reached without an extension or an
    // exports map, which bundlers allow and Node doesn't.
    if (e?.code !== "ERR_MODULE_NOT_FOUND" || path.extname(spec)) throw e;
    resolved = await next(spec + ".js", context);
  }
  /* A CommonJS package imported with named imports (`import { Pool } from
     "pg"`) only works when Node can statically spot the names, which it can't
     for pg. Wrap such packages in a small ES module that re-exports them. */
  const bare = !/^(node:|file:|\.|\/|@\/)/.test(specifier);
  if (bare && isCommonJS(resolved) && context.parentURL && inApp(context.parentURL)) {
    return { url: resolved.url + "?cjs", format: "module", shortCircuit: true };
  }
  return resolved;
}

/* Node reports no format at resolve time, so read it the way Node does: a .cjs
   file, or a .js file whose nearest package.json isn't "type": "module". */
function isCommonJS({ url, format }) {
  if (format) return format === "commonjs";
  if (!url.startsWith("file:")) return false;
  const file = fileURLToPath(url);
  if (file.endsWith(".cjs")) return true;
  if (!file.endsWith(".js")) return false;
  for (let dir = path.dirname(file); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const pkg = path.join(dir, "package.json");
    if (existsSync(pkg)) return JSON.parse(readFileSync(pkg, "utf8")).type !== "module";
  }
  return true;
}

/* App .js files are ESM; a JSON import becomes a module exporting it. */
export async function load(url, context, next) {
  if (url.endsWith("?cjs")) {
    const file = fileURLToPath(url.slice(0, -4));
    const names = Object.keys(createRequire(import.meta.url)(file)).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== "default");
    return { format: "module", shortCircuit: true, source:
      `import { createRequire } from "node:module";\n` +
      `const m = createRequire(import.meta.url)(${JSON.stringify(file)});\n` +
      `export default m;\nexport const { ${names.join(", ")} } = m;\n` };
  }
  if (inApp(url) && url.endsWith(".json")) {
    return { format: "module", shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), "utf8")};` };
  }
  if (inApp(url) && url.endsWith(".js")) {
    return { format: "module", shortCircuit: true, source: readFileSync(fileURLToPath(url), "utf8") };
  }
  return next(url, context);
}
