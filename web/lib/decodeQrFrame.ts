import jsQR from "jsqr";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

function barcodeDetector(): BarcodeDetectorLike | null {
  const ctor = (globalThis as { BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
  if (!ctor) return null;
  try {
    return new ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function drawVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  if (video.readyState < 2 || video.videoWidth < 32 || video.videoHeight < 32) {
    return null;
  }
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function decodeImageData(image: ImageData): string | null {
  const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
  const value = code?.data?.trim();
  return value || null;
}

export async function decodeQrFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<string | null> {
  const detector = barcodeDetector();
  if (detector) {
    try {
      const codes = await detector.detect(video);
      const value = codes[0]?.rawValue?.trim();
      if (value) return value;
    } catch {
      // Native detector can fail on an empty frame; fall through to jsQR.
    }
  }
  const image = drawVideoFrame(video, canvas);
  return image ? decodeImageData(image) : null;
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const detector = barcodeDetector();
  if (detector) {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const codes = await detector.detect(bitmap);
        const value = codes[0]?.rawValue?.trim();
        if (value) return value;
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to jsQR.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const imageEl = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image"));
      img.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = imageEl.naturalWidth;
    canvas.height = imageEl.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(imageEl, 0, 0);
    return decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
