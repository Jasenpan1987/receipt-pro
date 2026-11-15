"use client";

import { type MouseEvent, useEffect, useState } from "react";

import styles from "./photo-viewer.module.css";

/**
 * The full photo over the list (builder, 2026-11-16), instead of a new tab that had to be closed
 * and switched back from. Closes with the button, a tap anywhere but the photo, or Escape.
 */
export function PhotoViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [state, setState] = useState<"loading" | "shown" | "failed">("loading");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    // The list must not scroll behind the photo.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  // Only the photo itself keeps the viewer open; the dark area and the space around the photo close it.
  const onBackdrop = (event: MouseEvent) => {
    if (!(event.target instanceof HTMLImageElement)) {
      onClose();
    }
  };

  return (
    // A tap outside the photo is a shortcut; keyboard users have Escape and the close button.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="小票照片"
      onClick={onBackdrop}
    >
      <div className={styles.panel}>
        <button className={styles.close} type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
        {state === "loading" && <p className={styles.note}>正在加载…</p>}
        {state === "failed" && <p className={styles.note}>照片打不开，请关掉再试一次。</p>}
        {/* oxlint-disable-next-line nextjs/no-img-element */}
        <img
          className={state === "shown" ? styles.photo : styles.hidden}
          src={url}
          alt="小票照片"
          onLoad={() => setState("shown")}
          onError={() => setState("failed")}
        />
      </div>
    </div>
  );
}
