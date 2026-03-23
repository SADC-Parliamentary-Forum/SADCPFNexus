/**
 * Adds `exports` fields to packages that lack them, required by Turbopack.
 * Run automatically via `postinstall`.
 *
 * IMPORTANT: always point to the UMD bundle — the ES bundle has external
 * imports (@babel/runtime, fflate) that Turbopack would try to resolve and
 * fail on. The UMD bundle is fully self-contained.
 */
const fs = require("fs");
const path = require("path");

function patchExports(pkgName, exportsField) {
  const pkgJsonPath = path.join(
    __dirname,
    "../node_modules",
    pkgName,
    "package.json"
  );
  if (!fs.existsSync(pkgJsonPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  // Always overwrite — a previous run may have used the wrong (ES) bundle
  pkg.exports = exportsField;
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
  console.log(`[patch-packages] Patched exports for ${pkgName}`);
}

// Use UMD (fully bundled, no external imports) for all conditions
patchExports("jspdf", {
  ".": "./dist/jspdf.umd.min.js",
});

patchExports("jspdf-autotable", {
  ".": "./dist/jspdf.plugin.autotable.min.js",
});
