"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, Loader2, ScanLine, X } from "lucide-react";
import type { NormalizedFood } from "@/lib/food/types";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Point the camera at a barcode");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | undefined;
    let cancelled = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (result && !cancelled) {
            onDetected(result.getText());
          }
        },
      )
      .then((c) => {
        if (cancelled) c.stop();
        else controls = c;
      })
      .catch(() => {
        setMessage("Camera unavailable. Allow camera access, or type the number.");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/90">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 tap rounded-full bg-white/10 p-2"
        aria-label="Close scanner"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="relative aspect-square w-[80%] max-w-sm overflow-hidden rounded-3xl border border-white/20">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-accent shadow-glow" />
      </div>
      <p className="mt-6 px-8 text-center text-sm text-white/60">{message}</p>
    </div>
  );
}
