/** Open or download a PDF returned as an Axios blob, including JSON error blobs. */
export async function openPdfBlob(data: Blob, filename: string): Promise<string> {
  const type = (data.type || "").toLowerCase();
  const magic = await data.slice(0, 8).text();
  const looksLikePdf = magic.startsWith("%PDF");

  if (!looksLikePdf && (type.includes("json") || type.includes("text") || type === "" || magic.trim().startsWith("{") || magic.trim().startsWith("<"))) {
    throw await parseBlobError(data);
  }
  if (!looksLikePdf) {
    throw await parseBlobError(data);
  }

  const blob = data.type ? data : new Blob([data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return url;
}

async function parseBlobError(data: Blob): Promise<Error> {
  const text = await data.text();
  let message = "Print failed.";
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message) message = parsed.message;
  } catch {
    if (text.trim()) message = text.slice(0, 240);
  }
  return new Error(message);
}
