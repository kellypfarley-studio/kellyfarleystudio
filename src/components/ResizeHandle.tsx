import { useRef } from "react";
import type { RefObject } from "react";

export type ResizeHandleProps = {
  varName: "preview" | "back" | "front"; // support legacy values
  canvasRef: RefObject<HTMLDivElement | null>;
  min?: number;
  max?: number;
};

export default function ResizeHandle({ varName, canvasRef, min = 120, max = 1200 }: ResizeHandleProps) {
  const draggingRef = useRef(false);

  const onPointerDown = (ev: React.PointerEvent) => {
    ev.preventDefault();
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const planH = parseFloat(style.getPropertyValue("--planH")) || 320;
    const frontH = parseFloat(style.getPropertyValue("--previewH")) || 520;
    const canvasTop = canvasRef.current?.getBoundingClientRect().top || 0;

    draggingRef.current = true;

    const onMove = (mev: PointerEvent) => {
      if (!draggingRef.current) return;
      const y = mev.clientY;
      if (varName === "front" || varName === "preview") {
        const newH = Math.max(min, Math.min(max, y - (canvasTop + planH)));
        root.style.setProperty("--previewH", `${newH}px`);
      } else {
        // back handle: distance from top of back row (legacy)
        const newH = Math.max(min, Math.min(max, y - (canvasTop + planH + frontH)));
        root.style.setProperty("--backH", `${newH}px`);
      }
    };

    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // capture pointer so we get events outside the handle
    (ev.target as Element).setPointerCapture(ev.pointerId);
  };

  return <div className="resizeHandle" onPointerDown={onPointerDown} role="separator" aria-orientation="vertical"></div>;
}
