import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";

type TouchPaintCtx = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

/**
 * Browser default touch handlers are passive; calling preventDefault (for drawing)
 * warns and no-ops. Use native listeners with { passive: false } on the canvas element.
 *
 * Keeps painting logic duplicated from JSX mouse handlers minimally — callers pass
 * getPos(canvas, TouchEvent).
 */
export function attachCanvasPassiveFalseTouchListeners(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  refs: {
    lastPos: MutableRefObject<{ x: number; y: number } | null>;
    getPos: (
      canvas: HTMLCanvasElement,
      e: MouseEvent | TouchEvent
    ) => { x: number; y: number };
    getPaintCtx: () => TouchPaintCtx | null;
    setHasStrokes: Dispatch<SetStateAction<boolean>>;
  }
): () => void {
  const el = canvasRef.current;
  if (!el) {
    return () => {};
  }

  let gestureActive = false;

  function startDrawNative(e: TouchEvent) {
    e.preventDefault();
    const pk = refs.getPaintCtx();
    if (!pk) return;
    const pos = refs.getPos(pk.canvas, e);
    gestureActive = true;
    refs.lastPos.current = pos;
    pk.ctx.beginPath();
    pk.ctx.moveTo(pos.x, pos.y);
  }

  function moveDrawNative(e: TouchEvent) {
    if (!gestureActive) return;
    e.preventDefault();
    const pk = refs.getPaintCtx();
    if (!pk) return;
    const pos = refs.getPos(pk.canvas, e);
    pk.ctx.lineTo(pos.x, pos.y);
    pk.ctx.stroke();
    refs.lastPos.current = pos;
    refs.setHasStrokes(true);
  }

  function endDrawNative(e: TouchEvent) {
    e.preventDefault();
    gestureActive = false;
    refs.lastPos.current = null;
  }

  const opts: AddEventListenerOptions = { passive: false };
  el.addEventListener("touchstart", startDrawNative, opts);
  el.addEventListener("touchmove", moveDrawNative, opts);
  el.addEventListener("touchend", endDrawNative, opts);
  el.addEventListener("touchcancel", endDrawNative, opts);

  return () => {
    el.removeEventListener("touchstart", startDrawNative, opts as EventListenerOptions);
    el.removeEventListener("touchmove", moveDrawNative, opts as EventListenerOptions);
    el.removeEventListener("touchend", endDrawNative, opts as EventListenerOptions);
    el.removeEventListener("touchcancel", endDrawNative, opts as EventListenerOptions);
  };
}
