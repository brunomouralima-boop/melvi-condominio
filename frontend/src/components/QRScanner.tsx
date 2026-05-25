import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onScan: (text: string) => void;
  onClose?: () => void;
}

export function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!active) return;
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId;
        if (!deviceId) {
          setError("Nenhuma câmara encontrada");
          return;
        }
        if (cancelled) return;
        const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result) => {
          if (result) {
            const text = result.getText();
            controlsRef.current?.stop();
            setActive(false);
            onScan(text);
          }
        });
        controlsRef.current = controls;
      } catch (e: any) {
        setError(e?.message || "Falha ao aceder à câmara. Verifique as permissões.");
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [active, onScan]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 border-4 border-coral-500/70 rounded-xl" />
      </div>
      {error && (
        <div className="text-sm text-coral-700 bg-coral-50 border border-coral-200 rounded-lg p-3 flex items-start gap-2">
          <Camera className="h-5 w-5 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}
      {onClose && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" /> Fechar scanner
          </Button>
        </div>
      )}
    </div>
  );
}
