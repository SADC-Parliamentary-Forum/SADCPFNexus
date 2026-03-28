"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saamApi } from "@/lib/api";

type SigType = "full" | "initials";

export default function DrawSignaturePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sigType, setSigType] = useState<SigType>("full");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [penSize, setPenSize] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Initialize canvas with white background
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [penSize]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // Update pen size without clearing canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = penSize;
  }, [penSize]);

  function getPos(
    canvas: HTMLCanvasElement,
    e: MouseEvent | TouchEvent
  ): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasStrokes(false);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasStrokes) {
      setError("Please draw your signature before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await saamApi.draw(sigType, dataUrl);
      showToast("Signature saved successfully.");
      setTimeout(() => router.push("/saam"), 1000);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to save signature. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white bg-green-600 shadow-lg">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
          <Link href="/saam" className="hover:text-neutral-600 transition-colors">
            SAAM
          </Link>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span className="text-neutral-600 font-medium">Draw Signature</span>
        </div>
        <h1 className="page-title">Draw Your Signature</h1>
        <p className="page-subtitle">
          Use your mouse or touch to draw your signature on the canvas below.
        </p>
      </div>

      {/* Type selector */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Signature Type</p>
          <div className="flex gap-2">
            {(["full", "initials"] as SigType[]).map((t) => (
              <button
                key={t}
                onClick={() => setSigType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sigType === t
                    ? "bg-primary text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {t === "full" ? "draw" : "text_fields"}
                </span>
                {t === "full" ? "Full Signature" : "Initials"}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div className="px-5 py-4 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600">Pen size:</span>
              {[1, 2, 3, 5].map((size) => (
                <button
                  key={size}
                  onClick={() => setPenSize(size)}
                  title={`${size}px`}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    penSize === size
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-neutral-100 hover:bg-neutral-200"
                  }`}
                >
                  <div
                    className="rounded-full bg-neutral-700"
                    style={{ width: size * 2, height: size * 2 }}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={clearCanvas}
              className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">clear</span>
              Clear
            </button>
          </div>

          {/* Canvas */}
          <div className="border-2 border-dashed border-neutral-300 rounded-xl overflow-hidden bg-white select-none">
            <canvas
              ref={canvasRef}
              width={560}
              height={220}
              className="w-full touch-none cursor-crosshair"
              style={{ display: "block" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          {!hasStrokes && (
            <p className="text-xs text-neutral-400 text-center">
              Draw your{" "}
              {sigType === "full" ? "full signature" : "initials"} above
            </p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <span
            className="material-symbols-outlined text-[16px] flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            error
          </span>
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href="/saam" className="btn-secondary text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </Link>
        <button
          onClick={save}
          disabled={saving || !hasStrokes}
          className="btn-primary text-sm disabled:opacity-60"
        >
          {saving ? (
            <span className="material-symbols-outlined text-[16px] animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[16px]">save</span>
          )}
          {saving ? "Saving…" : "Save Signature"}
        </button>
      </div>
    </div>
  );
}
