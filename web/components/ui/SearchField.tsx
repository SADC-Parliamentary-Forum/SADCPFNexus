"use client";

/**
 * Search box with a leading icon and a clear button. Filtering is left to the
 * caller (client-side or a debounced API query).
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  clearLabel = "Clear search",
  testId,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
  clearLabel?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <span
        className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-neutral-400"
        aria-hidden="true"
      >
        search
      </span>
      <input
        type="search"
        className="form-input w-full pl-9 pr-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoComplete="off"
        data-testid={testId}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"
          onClick={() => onChange("")}
          aria-label={clearLabel}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
        </button>
      ) : null}
    </div>
  );
}
