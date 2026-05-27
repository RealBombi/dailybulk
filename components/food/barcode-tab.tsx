"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { motion } from "framer-motion";
import { Camera, ChevronLeft, Loader2, ScanLine } from "lucide-react";
import type { NormalizedFood } from "@/lib/food/types";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Portal } from "@/components/ui/portal";
import { PortionEditor } from "./portion-editor";

export function BarcodeTab({
  onAdded,
  date,
}: {
  onAdded: () => void;
  date?: string;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<NormalizedFood | null>(null);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    // Camera needs a secure context (https or localhost) and a camera API.
    setCanScan(
      typeof window !== "undefined" &&
        window.isSecureContext &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  const lookup = async (barcode: string) => {
    const value = barcode.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setProduct(null);
    try {
      const res = await fetch(
        `/api/food/barcode?code=${encodeURIComponent(value)}`,
      );
      if (res.status === 404) {
        setError("No product found for that barcode. Try Manual add.");
        return;
      }
      if (!res.ok) {
        setError("Lookup failed. Try again or add manually.");
        return;
      }
      const json = await res.json();
      setProduct(json.product as NormalizedFood);
    } catch {
      setError("Lookup failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="Enter barcode number"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-9 pr-3 text-sm outline-none focus:border-accent/60"
          />
        </div>
        <Button type="submit" disabled={loading || !code.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </Button>
      </form>

      {canScan ? (
        <Button variant="secondary" size="lg" onClick={() => setScanning(true)}>
          <Camera className="h-5 w-5" /> Scan with camera
        </Button>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/50">
          Camera scanning needs a secure (https) connection. On a local
          <span className="text-white/70"> http://</span> address, type the
          barcode number above instead.
        </p>
      )}

      {error && <p className="text-sm text-red-300">{error}</p>}

      {scanning && (
        <CameraScanner
          onClose={() => setScanning(false)}
          onDetected={(value) => {
            setScanning(false);
            setCode(value);
            lookup(value);
          }}
        />
      )}

      <Sheet open={!!product} onClose={() => setProduct(null)} title="Add product">
        {product && (
          <PortionEditor
            food={product}
            date={date}
            onAdded={() => {
              setProduct(null);
              onAdded();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function CameraScanner({
  onDetected,
  onClose,
}: {
  onDetected: (value: string) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("Align the barcode inside the frame");
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const cancelledRef = useRef(false);
  const startedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  // Start decoding once the <video> is actually in the DOM. A callback ref is
  // used (not useEffect) because the Portal mounts the video a tick later, so
  // an effect would run while the ref is still null and attach to nothing.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el || startedRef.current) return;
    startedRef.current = true;
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        el,
        (result) => {
          if (result && !cancelledRef.current) {
            onDetectedRef.current(result.getText());
          }
        },
      )
      .then((controls) => {
        if (cancelledRef.current) controls.stop();
        else controlsRef.current = controls;
      })
      .catch(() => {
        setMessage(
          "Couldn't start the camera. Allow camera access, or type the barcode.",
        );
      });
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] bg-black">
        <video
          ref={attachVideo}
          muted
          playsInline
          autoPlay
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/30" />

        {/* Top bar (interactive, above the decorative layers) */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="tap flex items-center gap-1 rounded-full bg-white/15 py-2 pl-2 pr-3 text-sm font-medium text-white backdrop-blur"
          >
            <ChevronLeft className="h-5 w-5" /> Back
          </button>
          <span className="rounded-full bg-white/15 px-3 py-2 text-sm text-white backdrop-blur">
            Scan barcode
          </span>
          <span className="w-[72px]" aria-hidden />
        </div>

        {/* Centered scan frame — purely decorative, must not eat taps */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-[5/3] w-[82%] max-w-sm">
            <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-white/85" />
            <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-white/85" />
            <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-white/85" />
            <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-white/85" />
            <motion.div
              className="absolute inset-x-3 h-[3px] rounded-full bg-accent shadow-[0_0_14px_2px_rgb(var(--accent)/0.7)]"
              initial={{ top: "10%" }}
              animate={{ top: ["10%", "90%", "10%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Instruction */}
        <p className="pointer-events-none absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] px-8 text-center text-sm text-white/80">
          {message}
        </p>
      </div>
    </Portal>
  );
}
