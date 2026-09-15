"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeQrFromImageFile, decodeQrFromVideo } from "@/lib/decodeQrFrame";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type CameraError = "denied" | "missing" | "unsupported" | "insecure" | "photo";

type Props = {
  active: boolean;
  onDetect: (raw: string) => void;
};

export function AssetQrCamera({ active, onDetect }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const decodingRef = useRef(false);
  const lastValueRef = useRef("");
  const lastAtRef = useRef(0);
  const devicesRef = useRef<string[]>([]);
  const deviceIndexRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setLive(false);
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const emit = useCallback((raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const now = Date.now();
    if (value === lastValueRef.current && now - lastAtRef.current < 2500) return;
    lastValueRef.current = value;
    lastAtRef.current = now;
    onDetect(value);
  }, [onDetect]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    if (!decodingRef.current) {
      decodingRef.current = true;
      void decodeQrFromVideo(video, canvas)
        .then((value) => {
          if (value) emit(value);
        })
        .finally(() => {
          decodingRef.current = false;
        });
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [emit]);

  const startStream = useCallback(async (deviceId?: string) => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      return;
    }
    if (!window.isSecureContext) {
      setError("insecure");
      return;
    }
    setBusy(true);
    setError(null);
    stopStream();
    const requestStream = (video: boolean | MediaTrackConstraints) =>
      navigator.mediaDevices.getUserMedia({ audio: false, video });
    try {
      let stream: MediaStream;
      try {
        stream = await requestStream(
          deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        );
      } catch (first) {
        const name = first instanceof DOMException ? first.name : "";
        if (deviceId || (name !== "OverconstrainedError" && name !== "NotFoundError")) {
          throw first;
        }
        stream = await requestStream(true);
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(Boolean(capabilities.torch));
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((item) => item.kind === "videoinput").map((item) => item.deviceId);
      devicesRef.current = cameras;
      setCanSwitch(cameras.length > 1);
      if (deviceId) {
        const idx = cameras.indexOf(deviceId);
        deviceIndexRef.current = idx >= 0 ? idx : 0;
      }
      setLive(true);
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("denied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("missing");
      } else {
        setError("unsupported");
      }
      stopStream();
    } finally {
      setBusy(false);
    }
  }, [scanLoop, stopStream]);

  useEffect(() => {
    if (!active) stopStream();
    return () => stopStream();
  }, [active, stopStream]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  function switchCamera() {
    const cameras = devicesRef.current;
    if (cameras.length < 2) return;
    deviceIndexRef.current = (deviceIndexRef.current + 1) % cameras.length;
    void startStream(cameras[deviceIndexRef.current]);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    const value = await decodeQrFromImageFile(file);
    if (value) {
      emit(value);
      return;
    }
    setError("photo");
  }

  const errorMessage = error && {
    denied: t("assets.scan.cameraDenied"),
    missing: t("assets.scan.cameraMissing"),
    unsupported: t("assets.scan.cameraUnsupported"),
    insecure: t("assets.scan.insecureContext"),
    photo: t("assets.scan.photoInvalid"),
  }[error];

  return (
    <div className="flex h-full flex-col">
      <div className="relative overflow-hidden rounded-2xl bg-neutral-950 shadow-inner">
        <div className="relative aspect-[4/3] w-full">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
            aria-label={t("assets.scan.cameraTitle")}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!live && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,_#1e293b_0%,_#0b1220_70%)] px-6 text-center">
              <span className="material-symbols-outlined text-5xl text-white/80" aria-hidden>
                qr_code_scanner
              </span>
              <p className="max-w-sm text-sm text-white/80">{t("assets.scan.cameraHint")}</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-[12%] rounded-sm">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-sm border-l-2 border-t-2 border-[#7db2ee]" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-sm border-r-2 border-t-2 border-[#7db2ee]" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-sm border-b-2 border-l-2 border-[#7db2ee]" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-sm border-b-2 border-r-2 border-[#7db2ee]" />
          </div>
          {live && (
            <div className="pointer-events-none absolute inset-x-[18%] top-1/2 h-px bg-[#7db2ee]/90 shadow-[0_0_12px_#1a65bb]" />
          )}
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {live ? (
          <button type="button" className="btn-secondary" onClick={stopStream} data-testid="scan-stop-camera">
            <span className="material-symbols-outlined text-[18px]" aria-hidden>stop_circle</span>
            {t("assets.scan.stopCamera")}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void startStream()}
            disabled={busy || !active}
            data-testid="scan-start-camera"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>photo_camera</span>
            {busy ? t("common.loading") : t("assets.scan.startCamera")}
          </button>
        )}
        {live && canSwitch && (
          <button type="button" className="btn-secondary" onClick={switchCamera}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden>cameraswitch</span>
            {t("assets.scan.switchCamera")}
          </button>
        )}
        {live && torchAvailable && (
          <button type="button" className="btn-secondary" onClick={() => void toggleTorch()}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              {torchOn ? "flash_on" : "flash_off"}
            </span>
            {torchOn ? t("assets.scan.torchOff") : t("assets.scan.torchOn")}
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileRef.current?.click()}
          data-testid="scan-use-photo"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>image</span>
          {t("assets.scan.usePhoto")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          data-testid="scan-qr-file"
          aria-label={t("assets.scan.photoHint")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPhoto(file);
          }}
        />
      </div>
    </div>
  );
}
