"use client";

/**
 * Compact Prev/Next pager matching correspondence / salary-advance chrome.
 * Hide when only one page exists.
 */
export function ListPagination({
  page,
  lastPage,
  total,
  onPageChange,
  disabled = false,
  className = "",
}: {
  page: number;
  lastPage: number;
  total?: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (lastPage <= 1) return null;

  return (
    <div
      className={`flex items-center justify-between border-t border-neutral-200 px-4 py-3 ${className}`}
    >
      <p className="text-xs text-neutral-500">
        Page {page} of {lastPage}
        {typeof total === "number" ? ` (${total} total)` : ""}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={disabled || page >= lastPage}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
