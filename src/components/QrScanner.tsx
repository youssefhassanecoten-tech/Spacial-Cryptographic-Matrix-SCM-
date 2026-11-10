import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanLine, Upload } from "lucide-react";
import { Button } from "./ui";

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (image: ImageBitmapSource) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function getDetectorConstructor(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
      .BarcodeDetector ?? null
  );
}

export function QrScanner({
  onValue,
  label = "Scan share QR",
}: {
  onValue: (value: string) => void;
  label?: string;
}) {
  const Detector = getDetectorConstructor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [camera, setCamera] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const scanImage = async (file: File) => {
    if (!Detector) {
      setStatus("QR image decoding is not supported in this browser.");
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const results = await detector.detect(image);
      if (results[0]?.rawValue) {
        onValue(results[0].rawValue);
        setStatus("QR decoded.");
      } else {
        setStatus("No QR code found in that image.");
      }
    } catch {
      setStatus("Could not decode that image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const stopCamera = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera(false);
  };

  const startCamera = async () => {
    if (!Detector) {
      setStatus("Camera QR decoding is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      setCamera(true);
      setStatus("Point the camera at a QR card.");
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current) {
          return;
        }
        try {
          const results = await detectorRef.current.detect(videoRef.current);
          if (results[0]?.rawValue) {
            onValue(results[0].rawValue);
            setStatus("QR decoded.");
            stopCamera();
          }
        } catch {
          return;
        }
      }, 650);
    } catch {
      setStatus("Camera permission was denied or unavailable.");
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-500">
          <ScanLine className="h-3 w-3 text-cyan-300" />
          {label}
        </span>
        {camera ? (
          <Button size="sm" variant="ghost" onClick={stopCamera}>
            <CameraOff className="h-3 w-3" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void startCamera()}
            disabled={!Detector}
          >
            <Camera className="h-3 w-3" />
            Camera
          </Button>
        )}
      </div>
      {camera ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className="mt-2 aspect-video w-full rounded-lg bg-black object-cover"
        />
      ) : null}
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-2 py-2 text-[9px] text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200">
        <Upload className="h-3 w-3" />
        Scan QR image
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void scanImage(file);
            }
            event.target.value = "";
          }}
        />
      </label>
      {status ? (
        <p className="mt-1.5 text-[9px] leading-relaxed text-slate-500">{status}</p>
      ) : null}
      {!Detector ? (
        <p className="mt-1.5 text-[9px] leading-relaxed text-amber-300/80">
          BarcodeDetector is unavailable. Paste shares manually or use a supported
          browser.
        </p>
      ) : null}
    </div>
  );
}
