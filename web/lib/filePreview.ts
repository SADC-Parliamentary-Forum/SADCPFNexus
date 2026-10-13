const PREVIEWABLE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** The file's MIME type if it is safe to preview inline, otherwise null (e.g. HTML or SVG). */
export function previewableFileType(file: File): string | null {
  const type = file.type.toLowerCase();
  return PREVIEWABLE_TYPES.has(type) ? type : null;
}

/**
 * Object URL for an inline preview of a user-selected file. The blob is re-typed to the
 * allow-listed MIME type, so a renamed HTML file can never render as a page in our origin.
 * Callers must revoke the URL when done.
 */
export function createFilePreviewUrl(file: File): string | null {
  const type = previewableFileType(file);
  if (!type) return null;
  return URL.createObjectURL(new Blob([file], { type }));
}
