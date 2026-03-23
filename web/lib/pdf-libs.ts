/**
 * Loads jsPDF and jspdf-autotable at runtime via browser <script> injection.
 *
 * WHY: jspdf 2.5.2 lacks an `exports` field (required by Turbopack), and every
 * jspdf-autotable bundle contains `require('jspdf')` which Turbopack tries to
 * statically resolve and fails on. Loading from /vendors/ at runtime is
 * invisible to the bundler.
 *
 * The UMD bundles are copied from node_modules into public/vendors/ by
 * scripts/vendor-pdf.js, which runs via `postinstall` and `prebuild`.
 */

type jsPDFCtor = typeof import("jspdf").jsPDF;
type AutoTableFn = (typeof import("jspdf-autotable"))["default"];

let cache: Promise<{ jsPDF: jsPDFCtor; autoTable: AutoTableFn }> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function loadPdfLibs() {
  if (!cache) {
    cache = (async () => {
      // jspdf must load first — autotable patches jsPDF.API on load
      await loadScript("/vendors/jspdf.umd.min.js");
      await loadScript("/vendors/jspdf.plugin.autotable.min.js");

      // jspdf UMD sets window.jspdf (lowercase) — the constructor is window.jspdf.jsPDF
      // jspdf-autotable UMD patches jsPDF.API, so use doc.autoTable(options)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const jsPDF = w.jspdf.jsPDF as jsPDFCtor;
      const autoTable: AutoTableFn = (doc, options) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).autoTable(options);
      return { jsPDF, autoTable };
    })();
  }
  return cache;
}
