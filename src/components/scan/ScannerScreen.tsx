import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Image as ImageIcon, PenLine, CameraOff } from "lucide-react";
import { ScanBrackets } from "./ScanCaptureScreen";

/**
 * The viewfinder. Tapping scan used to hand straight off to the system camera sheet,
 * which meant leaving the app to take a photo and coming back; this keeps the camera
 * inside the app, so the frame, the gallery and the manual entry are all one screen.
 *
 * The stream is opened on open and stopped on close — a camera left running is a lit
 * indicator light and a flat battery.
 */
export default function ScannerScreen({ open, onCapture, onManual, onClose }: {
  open: boolean;
  onCapture: (file: File) => void;
  onManual: () => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"starting" | "live" | "blocked">("starting");
  const [shooting, setShooting] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    let cancelled = false;
    setStatus("starting");
    setShooting(false);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => undefined);
        }
        setStatus("live");
      })
      .catch(() => {
        // No camera, no permission, or a browser that will not hand one over — the
        // system camera sheet still works, so offer that rather than a dead end.
        if (!cancelled) setStatus("blocked");
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop]);

  // The screen owns the viewport while it is up
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleShutter = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || shooting) return;
    setShooting(true);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setShooting(false);
          return;
        }
        stop();
        onCapture(new File([blob], `comprovante-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }, [onCapture, shooting, stop]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    stop();
    onCapture(file);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-label="Escanear comprovante"
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* The frame only means something once there is a picture behind it */}
          {status === "live" && <ScanBrackets />}

          {/* A white flash on the shutter, so the tap is felt */}
          <AnimatePresence>
            {shooting && (
              <motion.span
                className="absolute inset-0 bg-white"
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32 }}
              />
            )}
          </AnimatePresence>

          {status === "blocked" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08]">
                <CameraOff className="h-6 w-6 text-white/70" />
              </span>
              <p className="text-[15px] font-semibold text-white">Não conseguimos abrir a câmera</p>
              <p className="text-[13px] leading-snug text-white/60">
                Libere o acesso à câmera nas configurações, ou use a câmera do sistema e a galeria aqui embaixo.
              </p>
              <button
                onClick={() => nativeCameraRef.current?.click()}
                className="mt-1 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-black active:opacity-80"
              >
                Tirar foto
              </button>
            </div>
          )}

          {/* Top bar */}
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-between px-5"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
          >
            <button
              onClick={() => { stop(); onClose(); }}
              aria-label="Fechar"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur-md active:opacity-70"
            >
              <X className="h-5 w-5 text-white" strokeWidth={2.2} />
            </button>
            {status === "live" && (
              <span className="rounded-full bg-black/45 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-md">
                Aponte para o comprovante
              </span>
            )}
            <span className="h-10 w-10" />
          </div>

          {/* Controls */}
          <div
            className="absolute inset-x-0 bottom-0 px-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 26px)" }}
          >
            <div className="flex justify-center">
              <button
                onClick={onManual}
                className="mb-6 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-4 py-3 text-[14px] font-semibold text-white backdrop-blur-md active:opacity-75"
              >
                <PenLine className="h-4 w-4" strokeWidth={2.2} />
                Adicionar manualmente
              </button>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => galleryRef.current?.click()}
                aria-label="Escolher da galeria"
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-white/15 bg-black/45 backdrop-blur-md active:opacity-70"
              >
                <ImageIcon className="h-[22px] w-[22px] text-white" strokeWidth={2} />
              </button>

              <button
                onClick={handleShutter}
                disabled={status !== "live" || shooting}
                aria-label="Tirar foto"
                className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-white/85 disabled:opacity-40 active:scale-95 transition-transform"
              >
                <span className="h-[60px] w-[60px] rounded-full bg-white" />
              </button>

              {/* Balances the gallery button so the shutter sits dead centre */}
              <span className="h-[52px] w-[52px]" />
            </div>
          </div>

          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <input ref={nativeCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
