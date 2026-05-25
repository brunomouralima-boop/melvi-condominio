import { useEffect, useRef, useState, useCallback } from "react";
import { Siren, X, PhoneCall } from "lucide-react";
import { useSocketEvent } from "@/contexts/SocketContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { PanicAlertPayload } from "@/types";
import toast from "react-hot-toast";

/**
 * Listens for panic:alert events and renders a top-of-screen alert banner.
 * Plays an alarm sound automatically (loops until acknowledged).
 * Used by AdminLayout and DoormanLayout.
 */
export function PanicAlertListener({ doormanMode = false }: { doormanMode?: boolean }) {
  const [active, setActive] = useState<PanicAlertPayload | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<{ stop: () => void } | null>(null);

  const startAlarm = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      // Two alternating tones (siren effect)
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.connect(gain);

      const now = ctx.currentTime;
      // Sweeping siren — alternate freq every 0.4s
      const startFreq = 440;
      const endFreq = 880;
      const period = 0.8;
      const duration = 60; // up to 1 minute if not stopped
      for (let t = 0; t < duration; t += period) {
        osc.frequency.setValueAtTime(startFreq, now + t);
        osc.frequency.linearRampToValueAtTime(endFreq, now + t + period / 2);
        osc.frequency.linearRampToValueAtTime(startFreq, now + t + period);
      }
      osc.start(now);
      osc.stop(now + duration);
      oscRef.current = { stop: () => osc.stop() };
    } catch (e) {
      console.warn("Alarm sound failed:", e);
    }
  }, []);

  const stopAlarm = useCallback(() => {
    try {
      oscRef.current?.stop();
    } catch {
      /* already stopped */
    }
    oscRef.current = null;
  }, []);

  useSocketEvent<PanicAlertPayload>("panic:alert", (payload) => {
    setActive(payload);
    startAlarm();
    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("🚨 ALERTA DE PÂNICO", {
          body: `${payload.unit} — ${payload.residentName}: ${payload.description}`,
          requireInteraction: true,
        });
      } catch {
        /* ignore */
      }
    }
    toast.error(`Alerta de pânico: ${payload.unit}`, { duration: 10000 });
  });

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const acknowledge = useCallback(async () => {
    if (!active) return;
    try {
      await api.put(`/panic-alerts/${active.id}/acknowledge`);
      toast.success("Alerta confirmado");
    } catch (e) {
      toast.error("Falha ao confirmar alerta");
    } finally {
      stopAlarm();
      setActive(null);
    }
  }, [active, stopAlarm]);

  const dismiss = useCallback(() => {
    stopAlarm();
    setActive(null);
  }, [stopAlarm]);

  if (!active) return null;

  return (
    <div
      className={`sticky top-0 z-30 w-full animate-panic-pulse text-white shadow-2xl ${
        doormanMode ? "px-6 py-6" : "px-6 py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-4">
        <Siren className={doormanMode ? "h-12 w-12 shrink-0 animate-pulse" : "h-8 w-8 shrink-0"} />
        <div className="flex-1">
          <div className={doormanMode ? "font-display text-2xl font-bold" : "font-display text-lg font-bold"}>
            🚨 ALERTA DE PÂNICO — {active.unit}
          </div>
          <div className={doormanMode ? "mt-1 text-lg" : "mt-1 text-sm"}>
            <span className="font-semibold">{active.residentName}</span>
            {active.residentPhone && (
              <a href={`tel:${active.residentPhone}`} className="ml-2 inline-flex items-center gap-1 underline">
                <PhoneCall className="h-4 w-4" />
                {active.residentPhone}
              </a>
            )}
          </div>
          <div className={doormanMode ? "mt-2 text-lg" : "mt-1 text-sm opacity-95"}>
            <span className="font-semibold">Descrição: </span>
            {active.description}
          </div>
          <div className="mt-1 text-xs opacity-80">{new Date(active.timestamp).toLocaleString("pt-PT")}</div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={acknowledge}
            size={doormanMode ? "xl" : "lg"}
            className="bg-white text-coral-700 hover:bg-slate-100 font-bold"
          >
            CONFIRMAR RECEBIMENTO
          </Button>
          <Button onClick={dismiss} variant="ghost" size="sm" className="text-white hover:bg-white/20">
            <X className="h-4 w-4" /> Silenciar
          </Button>
        </div>
      </div>
    </div>
  );
}
