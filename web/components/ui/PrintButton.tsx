"use client";

import { cn } from "@/lib/utils";

interface PrintButtonProps {
  label?: string;
  className?: string;
}

const PRINT_STYLES = `
@media print {
  /* Hide non-content elements */
  header,
  nav,
  aside,
  .sidebar,
  [data-sidebar],
  .no-print,
  [data-print-hide],
  button,
  .btn-primary,
  .btn-secondary {
    display: none !important;
  }

  /* Ensure the main content fills the page */
  html,
  body {
    background: white !important;
    color: black !important;
    font-size: 12pt;
  }

  main,
  [data-print-content],
  .print-content {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }

  /* Strip card shadows and borders */
  .card,
  [class*="shadow"],
  [class*="rounded"] {
    box-shadow: none !important;
    border-color: #e5e7eb !important;
  }

  /* Keep tables intact */
  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }

  /* Remove link underlines that clutter prints */
  a {
    text-decoration: none !important;
    color: inherit !important;
  }
}
`;

export function PrintButton({ label = "Print", className }: PrintButtonProps) {
  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Inject print styles once into the document head */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} /> {/* ship-safe-ignore: static CSS constant, no user input */}

      <button
        type="button"
        onClick={handlePrint}
        className={cn(
          "btn-secondary inline-flex items-center gap-2",
          className
        )}
      >
        <span className="material-symbols-outlined text-[18px]">print</span>
        {label}
      </button>
    </>
  );
}
