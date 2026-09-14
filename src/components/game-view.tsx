import { useEffect, useRef, useState } from "react";
import { PotsGame, type HudSnap } from "@/game/engine";

const SHOP = "https://linktr.ee/BodkinpointseafoodLuke";

const idleHud: HudSnap = {
  phase: "title",
  timeLeft: 120,
  potsPulled: 0,
  hatOn: false,
  note: null,
};

export function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PotsGame | null>(null);
  const [hud, setHud] = useState<HudSnap>(idleHud);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new PotsGame(canvas, (snap) => {
      setHud((prev) => {
        if (
          prev.phase === snap.phase &&
          prev.potsPulled === snap.potsPulled &&
          prev.hatOn === snap.hatOn &&
          prev.note === snap.note
        ) {
          return prev;
        }
        return snap;
      });
    });
    gameRef.current = game;
    game.start();

    const down = (e: KeyboardEvent) => {
      game.setKey(e.code, true);
      if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => game.setKey(e.code, false);
    const blur = () => {
      game.setKey("KeyA", false);
      game.setKey("KeyD", false);
      game.setKey("KeyW", false);
      game.pointerUp();
    };
    const vis = () => {
      if (document.visibilityState === "visible") game.unlockAudio();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      game.stop();
      gameRef.current = null;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-3 py-4 text-fg">
      <p className="mb-2 text-xs font-bold tracking-[0.22em] text-cream uppercase">
        FV Southern Girl · Bodkin Point Seafood
      </p>
      <div className="relative aspect-[3/4] w-full max-w-[min(92vw,calc((92dvh-72px)*0.75),480px)] overflow-hidden rounded-md border-[3px] border-border shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        <canvas
          ref={canvasRef}
          width={640}
          height={854}
          className="block h-full w-full touch-none bg-bay"
          onPointerDown={(e) => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            gameRef.current?.pointerDown(e.clientX);
          }}
          onPointerMove={(e) => gameRef.current?.pointerMove(e.clientX)}
          onPointerUp={() => gameRef.current?.pointerUp()}
          onPointerCancel={() => gameRef.current?.pointerUp()}
        />

        {(hud.phase === "play" || hud.phase === "haul") && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end px-3 py-2.5 text-sm font-bold text-cream [text-shadow:0_1px_2px_#000]">
            <span>Pots {hud.potsPulled}</span>
          </div>
        )}

        {hud.phase === "title" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(12,28,42,0.72),rgba(12,22,30,0.88))] px-6 text-center">
            <h1 className="mb-1 text-3xl font-bold tracking-wide text-cream">SOUTHERN GIRL POTS</h1>
            <p className="mb-4 text-sm text-muted">A two-minute line on the Chesapeake</p>
            <div className="mb-5 w-full max-w-sm rounded-md border border-cream/20 bg-bg/40 px-3.5 py-3 text-left text-sm leading-snug text-fg">
              Hold left or right to run the boat. It turns around with you.
              <br />
              When the bow is over a pot, tap to haul it.
              <br />
              Grab the CAPSTILLER hat if it floats by.
              <br />
              Miss a pot while wearing it and the hat flies off.
              <br />
              Read the notes. Hit LET’S CRAB to keep pulling.
            </div>
            <button
              type="button"
              className="rounded bg-primary px-7 py-3 text-base font-extrabold tracking-[0.14em] text-cream uppercase shadow-[0_3px_0_var(--color-primary-shadow)] active:translate-y-0.5 active:shadow-none"
              onClick={() => gameRef.current?.play()}
            >
              PLAY
            </button>
            <p className="mt-3.5 text-xs text-muted/80">Inspired by Capt. Luke McFadden · not an official product</p>
          </div>
        )}

        {hud.phase === "end" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(180deg,rgba(12,28,42,0.72),rgba(12,22,30,0.88))] px-6 text-center">
            <h2 className="mb-1 text-3xl font-bold tracking-wide text-cream">HEAD TO THE STAND</h2>
            <p className="mb-4 text-sm text-muted">
              {hud.potsPulled} pot{hud.potsPulled === 1 ? "" : "s"} pulled
              {hud.hatOn ? " · CAPSTILLER secured" : ""}
            </p>
            <p className="mb-2 text-sm leading-relaxed text-fg">
              7333 E Furnace Branch Rd
              <br />
              Glen Burnie, MD 21060
              <br />
              Fri–Sun · (410) 979-9941
            </p>
            <p className="mb-4 text-sm text-fg">Boat to throat. Come get the real ones.</p>
            <button
              type="button"
              className="rounded bg-primary px-7 py-3 text-base font-extrabold tracking-[0.14em] text-cream uppercase shadow-[0_3px_0_var(--color-primary-shadow)] active:translate-y-0.5 active:shadow-none"
              onClick={() => gameRef.current?.play()}
            >
              RUN IT AGAIN
            </button>
            <a
              className="mt-3 text-sm font-bold text-cream underline-offset-2 hover:underline"
              href={SHOP}
              target="_blank"
              rel="noopener noreferrer"
            >
              Luke’s links & shipping →
            </a>
          </div>
        )}

        {hud.note && hud.phase === "haul" && (
          <div className="absolute right-[8%] bottom-[10%] left-[8%] rounded border-[3px] border-note-edge bg-note px-3.5 py-3 text-left text-sm leading-snug text-note-ink shadow-[4px_4px_0_rgba(0,0,0,0.35)]">
            {hud.note.text}
            <span className="mt-1.5 block text-[11px] tracking-wider text-note-edge uppercase">{hud.note.tag}</span>
            <button
              type="button"
              className="mt-3 w-full rounded bg-primary px-3 py-2.5 text-sm font-extrabold tracking-[0.12em] text-cream uppercase shadow-[0_3px_0_var(--color-primary-shadow)] active:translate-y-0.5 active:shadow-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                gameRef.current?.dismissNote();
              }}
            >
              LET’S CRAB
            </button>
          </div>
        )}

        {hud.phase === "play" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-cream/55">
            ← hold left · tap pot to haul · hold right →
          </p>
        )}
      </div>
    </div>
  );
}
