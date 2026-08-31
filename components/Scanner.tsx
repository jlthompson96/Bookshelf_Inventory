"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeIsbn } from "@/lib/isbn";
import styles from "./AddBook.module.css";

/* The shape both the native API and the ponyfill satisfy. */
type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

/**
 * Chrome and Edge ship the Barcode Detection API; no WebKit browser does, so on
 * an iPhone — which is the whole point of a scanner — the native path silently
 * never fires. The ponyfill is a WASM build, several hundred kilobytes, and is
 * therefore imported only where it is actually needed and never at module
 * scope: the shelf page must not pay for a scanner it does not render.
 */
async function detector(): Promise<Detector> {
  const formats = ["ean_13"];
  const native = (globalThis as any).BarcodeDetector;

  if (native) {
    const supported: string[] = await native.getSupportedFormats?.().catch(() => []);
    if (!supported.length || supported.includes("ean_13")) return new native({ formats });
  }

  const { BarcodeDetector } = await import("barcode-detector/pure");
  return new BarcodeDetector({ formats: formats as any });
}

type Props = { onFound: (isbn: string) => void; busy: boolean };

export default function Scanner({ onFound, busy }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setScanning(false);
  }, []);

  /* A live camera left running behind a submitted form is both a battery cost
     and a privacy one, so the track is stopped on unmount, not just on close. */
  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.current = media;
      setScanning(true);
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch {
      /* Denied permission and no camera are the same recoverable situation:
         the ISBN can always be typed instead. */
      setError("No camera available. Type the ISBN below instead.");
      stop();
    }
  };

  useEffect(() => {
    if (!scanning) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;

    (async () => {
      let read: Detector;
      try {
        read = await detector();
      } catch {
        if (live) setError("Barcode scanning is unavailable here. Type the ISBN below instead.");
        return;
      }

      const tick = async () => {
        if (!live || !video.current || video.current.readyState < 2) {
          timer = setTimeout(tick, 200);
          return;
        }
        try {
          const codes = await read.detect(video.current);
          /* Validated before it is accepted: an EAN-13 is not necessarily a
             book, and a misread digit should keep the loop running rather than
             report a real book as unknown. */
          const hit = codes.map((c) => normalizeIsbn(c.rawValue)).find(Boolean);
          if (hit && live) {
            stop();
            onFound(hit);
            return;
          }
        } catch {
          /* A single failed frame is normal — motion blur, bad angle. */
        }
        if (live) timer = setTimeout(tick, 200);
      };

      tick();
    })();

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [scanning, onFound, stop]);

  return (
    <div className={styles.scanner}>
      {scanning ? (
        <>
          <div className={styles.viewport}>
            <video ref={video} className={styles.video} muted playsInline />
            <div className={styles.reticle} aria-hidden="true" />
          </div>
          <p className={styles.hint} role="status">
            Hold the barcode on the back cover inside the frame.
          </p>
          <button type="button" className={styles.chip} onClick={stop}>
            Stop camera
          </button>
        </>
      ) : (
        <button type="button" className={styles.scanButton} onClick={start} disabled={busy}>
          Scan a barcode
        </button>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
