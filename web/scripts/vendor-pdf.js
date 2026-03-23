/**
 * Copies jspdf UMD bundles from node_modules into public/vendors so they can
 * be loaded at runtime via <script> injection, bypassing Turbopack's module
 * resolution (jspdf 2.5.2 lacks an `exports` field; jspdf-autotable internally
 * requires jspdf which Turbopack tries to statically resolve and fails).
 *
 * Called automatically via `prebuild` and `postinstall`.
 */
const fs = require("fs");
const path = require("path");

const nm = path.join(__dirname, "../node_modules");
const dest = path.join(__dirname, "../public/vendors");

fs.mkdirSync(dest, { recursive: true });

const files = [
  ["jspdf/dist/jspdf.umd.min.js", "jspdf.umd.min.js"],
  [
    "jspdf-autotable/dist/jspdf.plugin.autotable.min.js",
    "jspdf.plugin.autotable.min.js",
  ],
];

for (const [src, out] of files) {
  const srcPath = path.join(nm, src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[vendor-pdf] WARNING: ${srcPath} not found — skipping`);
    continue;
  }
  fs.copyFileSync(srcPath, path.join(dest, out));
  console.log(`[vendor-pdf] Copied ${out}`);
}
