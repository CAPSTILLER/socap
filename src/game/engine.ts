export type GamePhase = "title" | "play" | "haul" | "end";

export type PotMsg = { tag: string; text: string };

export type HudSnap = {
  phase: GamePhase;
  timeLeft: number;
  potsPulled: number;
  hatOn: boolean;
  note: PotMsg | null;
};

type Pot = {
  worldX: number;
  y: number;
  bob: number;
  pulled: boolean;
  kind: string;
  buoy: string;
};

type Splash = { worldX: number; y: number; vx: number; vy: number; life: number };
type Crab = { ox: number; oy: number; s: number; w: number };
type Hat = {
  worldX: number;
  y: number;
  bob: number;
  taken: boolean;
  flying: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};
type WaterCrab = { worldX: number; y: number; vx: number; vy: number; s: number; w: number; life: number };

const W = 640;
const H = 854;
const POT_GAP = 560;
const POT_COUNT = 12;
const WORLD = POT_GAP * POT_COUNT;
const RUN_SECS = 120;
const BOAT_SCREEN_X = W * 0.42;
const HORIZON_Y = 400;
const BOAT_Y = 538;
const POT_Y = 558;
const HAT_Y = 520;

const MESSAGES: PotMsg[] = [
  { tag: "RIVAL NOTE", text: "Nice engine. Does the boat come with it or is that extra?" },
  { tag: "TOY", text: "Returned your left boot. The right one made better bait." },
  { tag: "BAIT", text: "Hot dog special. Crabs voted 12–0." },
  { tag: "BAIT", text: "Marshmallows. Don’t ask. They asked." },
  { tag: "RIVAL NOTE", text: "If you’re reading this, you’re in my line. Move over, TikTok." },
  { tag: "TOY", text: "Found your merch hat. The crabs look better in it." },
  { tag: "RIVAL NOTE", text: "Boat-to-throat? These ones requested Old Bay first." },
  { tag: "TOY", text: "Rubber duck from a rival skiff. She says hi. Reluctantly." },
  { tag: "EMPTY", text: "This pot was empty. Emotionally." },
  { tag: "CRABS", text: "Jimmies in here. Sooks next door. Don’t mix ’em, captain." },
  { tag: "RIVAL NOTE", text: "Your outboard called. It wants its dignity back." },
  { tag: "BAIT", text: "Pizza crust bait. Works. Don’t tell DNR the topping." },
  { tag: "RIVAL NOTE", text: "Stop filming every pot. Some of us have a brand too." },
  { tag: "TOY", text: "Toy tractor. Eastern Shore delivery. No signature required." },
  { tag: "RIVAL NOTE", text: "These crabs have seen your comments section. They’re tired." },
  { tag: "CRABS", text: "You ain’t no crabber… but you are in the right zip code." },
  { tag: "RIVAL NOTE", text: "Bay Bridge traffic is still faster than this haul." },
  { tag: "CRABS", text: "Left you a bushel of advice: steam ’em, don’t boil ’em." },
  { tag: "TOY", text: "Who put a glow stick in here. It’s not a rave, Luke." },
  { tag: "NOTE", text: "See you Friday–Sunday. 7333 E Furnace Branch. Bring cash and patience." },
];

const BAIT_KINDS = ["hotdog", "mallow", "pizza", "nugget", "corn", "crabs", "duck", "boot"];

function shuffle<T>(a: T[]): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function wrap(x: number): number {
  return ((x % WORLD) + WORLD) % WORLD;
}

function wrapDelta(x: number): number {
  let d = wrap(x);
  if (d > WORLD / 2) d -= WORLD;
  return d;
}

export class PotsGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  phase: GamePhase = "title";
  timeLeft = RUN_SECS;
  potsPulled = 0;
  hatOn = false;
  note: PotMsg | null = null;
  onHud: (s: HudSnap) => void;

  private boat = { worldX: 0, y: BOAT_Y, vx: 0, tilt: 0, facing: 1 };
  private pots: Pot[] = [];
  private hat: Hat | null = null;
  private splash: Splash[] = [];
  private crabsOnPot: Crab[] = [];
  private waterCrabs: WaterCrab[] = [];
  private hullCrabs: Crab[] = [];
  private haul: { pot: Pot; t: number; msg: PotMsg } | null = null;
  private msgQueue: PotMsg[] = [];
  private waterPhase = 0;
  private last = 0;
  private raf = 0;
  private keys = { l: false, r: false, w: false };
  private holding = false;
  private injectSteer: number | null = null;
  private running = false;
  private prevWorldX = 0;
  private crabSpawn = 0;
  private audioUnlocked = false;
  private tracks: {
    crabby: HTMLAudioElement;
    squares: HTMLAudioElement;
    steam: HTMLAudioElement;
  } | null = null;
  private radioMode: "off" | "crabby" | "squares" | "steam" = "off";
  private sunImg = new Image();
  private scenes: {
    img: HTMLImageElement;
    sunX: number;
    sunY: number;
    waterFrac: number;
  }[] = [];
  private blurBuf: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement, onHud: (s: HudSnap) => void) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2d unavailable");
    this.ctx = ctx;
    this.onHud = onHud;
    this.sunImg.src = "/bg/pixel-sun.png";
    const plates: { src: string; sunX: number; sunY: number; waterFrac: number }[] = [
      { src: "/bg/scenes/open.jpg", sunX: 0.5, sunY: 0.217, waterFrac: 0.786 },
      { src: "/bg/scenes/bridge.jpg", sunX: 0.498, sunY: 0.198, waterFrac: 0.786 },
      { src: "/bg/scenes/combo.jpg", sunX: 0.337, sunY: 0.217, waterFrac: 0.786 },
      { src: "/bg/scenes/light.jpg", sunX: 0.337, sunY: 0.217, waterFrac: 0.786 },
      { src: "/bg/scenes/skyline.jpg", sunX: 0.773, sunY: 0.162, waterFrac: 0.78 },
      { src: "/bg/scenes/island.jpg", sunX: 0.511, sunY: 0.165, waterFrac: 0.786 },
    ];
    this.scenes = plates.map((p) => {
      const img = new Image();
      img.src = p.src;
      return { img, sunX: p.sunX, sunY: p.sunY, waterFrac: p.waterFrac };
    });
    this.installProbe();
  }

  start() {
    this.running = true;
    this.last = performance.now();
    this.emit();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.installProbe();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.setRadio("off");
  }

  unlockAudio() {
    if (!this.tracks) {
      const make = (src: string) => {
        const a = new Audio(src);
        a.loop = true;
        a.preload = "auto";
        a.volume = 0.72;
        return a;
      };
      this.tracks = {
        crabby: make("/crabbyluke.mp3"),
        squares: make("/99-squares.mp3"),
        steam: make("/steamboat-cap.mp3"),
      };
    }
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    for (const a of Object.values(this.tracks)) {
      const p = a.play();
      if (p) void p.then(() => a.pause()).catch(() => {});
    }
  }

  private setRadio(mode: "off" | "crabby" | "squares" | "steam") {
    if (!this.tracks) return;
    if (mode === this.radioMode) return;
    const { crabby, squares, steam } = this.tracks;
    const pauseKeep = (a: HTMLAudioElement) => {
      if (!a.paused) a.pause();
    };
    const resume = (a: HTMLAudioElement) => {
      if (a.paused) void a.play().catch(() => {});
    };
    this.radioMode = mode;
    if (mode === "off") {
      crabby.pause();
      squares.pause();
      steam.pause();
      crabby.currentTime = 0;
      squares.currentTime = 0;
      steam.currentTime = 0;
      return;
    }
    if (mode === "steam") {
      pauseKeep(crabby);
      pauseKeep(squares);
      resume(steam);
    } else if (mode === "crabby") {
      pauseKeep(steam);
      pauseKeep(squares);
      resume(crabby);
    } else {
      pauseKeep(steam);
      pauseKeep(crabby);
      resume(squares);
    }
  }

  private updateRadio() {
    if (this.phase === "title" || this.phase === "end") {
      this.setRadio("off");
      return;
    }
    const moving = this.phase === "play" && Math.abs(this.boat.vx) > 22;
    if (moving) this.setRadio(this.hatOn ? "squares" : "crabby");
    else this.setRadio("steam");
  }

  play() {
    this.unlockAudio();
    this.resetPlay();
    this.phase = "play";
    this.emit();
  }

  setKey(code: string, down: boolean) {
    if (code === "KeyA" || code === "ArrowLeft") this.keys.l = down;
    if (code === "KeyD" || code === "ArrowRight") this.keys.r = down;
    if (code === "KeyW" || code === "ArrowUp") this.keys.w = down;
    if (down && (code === "Space" || code === "Enter")) {
      if (this.phase === "title" || this.phase === "end") this.play();
      else if (this.phase === "play") this.tryHaul();
      else if (this.phase === "haul") this.dismissNote();
    }
  }

  pointerDown(clientX: number) {
    if (this.phase === "haul") return;
    this.holding = true;
    this.setSideFromX(clientX);
    if (this.phase === "play") this.tryHaul();
  }

  pointerMove(clientX: number) {
    if (this.holding) this.setSideFromX(clientX);
  }

  pointerUp() {
    this.holding = false;
    this.keys.l = false;
    this.keys.r = false;
  }

  private setSideFromX(clientX: number) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * W;
    this.keys.l = nx < W * 0.42;
    this.keys.r = nx > W * 0.58;
  }

  private emit() {
    this.onHud({
      phase: this.phase,
      timeLeft: this.timeLeft,
      potsPulled: this.potsPulled,
      hatOn: this.hatOn,
      note: this.note,
    });
  }

  private nextMsg(): PotMsg {
    if (!this.msgQueue.length) this.msgQueue = shuffle(MESSAGES);
    return this.msgQueue.pop() as PotMsg;
  }

  private screenX(worldX: number): number {
    return BOAT_SCREEN_X + wrapDelta(worldX - this.boat.worldX);
  }

  private resetPlay() {
    this.boat.worldX = 0;
    this.boat.vx = 0;
    this.boat.tilt = 0;
    this.boat.facing = 1;
    this.prevWorldX = this.boat.worldX;
    this.pots = [];
    this.splash = [];
    this.crabsOnPot = [];
    this.waterCrabs = [];
    this.hullCrabs = [];
    this.haul = null;
    this.hatOn = false;
    this.potsPulled = 0;
    this.timeLeft = RUN_SECS;
    this.note = null;
    this.crabSpawn = 0;
    this.msgQueue = shuffle(MESSAGES);
    for (let i = 0; i < POT_COUNT; i++) {
      this.pots.push({
        worldX: i * POT_GAP + 520,
        y: POT_Y + Math.random() * 8,
        bob: Math.random() * Math.PI * 2,
        pulled: false,
        kind: BAIT_KINDS[Math.floor(Math.random() * BAIT_KINDS.length)],
        buoy: Math.random() > 0.5 ? "#d22" : "#eee",
      });
    }
    this.hat = {
      worldX: this.boat.worldX + 240,
      y: HAT_Y,
      bob: 0,
      taken: false,
      flying: 0,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
    };
    this.setRadio("off");
  }

  private nearestPot(): Pot | null {
    let best: Pot | null = null;
    let bestD = 120;
    for (const p of this.pots) {
      if (p.pulled) continue;
      const d = Math.abs(this.screenX(p.worldX + 10) - (BOAT_SCREEN_X + 55));
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  tryHaul() {
    if (this.phase !== "play") return;
    const p = this.nearestPot();
    if (!p) return;
    p.pulled = true;
    this.potsPulled += 1;
    const msg = this.nextMsg();
    this.haul = { pot: p, t: 0, msg };
    this.phase = "haul";
    this.note = msg;
    for (let i = 0; i < 10; i++) {
      this.splash.push({
        worldX: p.worldX + 10 + (Math.random() - 0.5) * 20,
        y: p.y,
        vx: (Math.random() - 0.5) * 2.2,
        vy: -1 - Math.random() * 2.4,
        life: 1,
      });
    }
    this.crabsOnPot = [];
    const n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      this.crabsOnPot.push({
        ox: (Math.random() - 0.5) * 28,
        oy: (Math.random() - 0.6) * 16,
        s: 0.7 + Math.random() * 0.5,
        w: Math.random() * 6,
      });
    }
    this.emit();
  }

  dismissNote() {
    if (this.phase !== "haul") return;
    this.note = null;
    this.phase = "play";
    this.haul = null;
    this.emit();
  }

  private putOnHat() {
    if (!this.hat) return;
    this.hat.taken = true;
    this.hat.flying = 0;
    this.hatOn = true;
    this.hullCrabs = [];
    for (let i = 0; i < 8; i++) {
      this.hullCrabs.push({
        ox: 10 + Math.random() * 90,
        oy: 2 + Math.random() * 16,
        s: 0.55 + Math.random() * 0.45,
        w: Math.random() * 6,
      });
    }
    this.updateRadio();
  }

  private knockHatOff() {
    if (!this.hatOn || !this.hat) return;
    this.hatOn = false;
    this.hat.taken = false;
    const behind = -this.boat.facing;
    const land = this.boat.worldX + behind * (90 + Math.random() * 220);
    this.hat.fromX = this.boat.worldX;
    this.hat.fromY = this.boat.y - 20;
    this.hat.toX = land;
    this.hat.toY = HAT_Y + Math.random() * 10;
    this.hat.flying = 0.001;
    this.hat.worldX = this.hat.fromX;
    this.hat.y = this.hat.fromY;
    this.hullCrabs = [];
    this.updateRadio();
  }

  private update(dt: number) {
    this.waterPhase += dt * 2.2;
    this.updateRadio();
    if (this.phase === "end" || this.phase === "title") return;

    if (this.phase === "haul" && this.haul) {
      this.haul.t += dt;
      for (const p of this.pots) p.bob += dt * 2;
      this.updateHat(dt);
      this.updateWaterCrabs(dt);
      return;
    }

    if (this.phase === "play") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.phase = "end";
        this.note = null;
        this.updateRadio();
        this.emit();
        return;
      }

      let dir = 0;
      if (this.injectSteer !== null) {
        dir = -this.injectSteer;
      } else {
        if (this.keys.l) dir -= 1;
        if (this.keys.r) dir += 1;
      }
      this.prevWorldX = this.boat.worldX;
      this.boat.vx += dir * 520 * dt;
      this.boat.vx *= Math.pow(0.04, dt);
      this.boat.worldX += this.boat.vx * dt;
      if (dir !== 0) this.boat.facing = dir;
      else if (Math.abs(this.boat.vx) > 12) this.boat.facing = Math.sign(this.boat.vx);
      const want = dir !== 0 ? 0.95 : 0.08;
      this.boat.tilt += (want - this.boat.tilt) * Math.min(1, dt * 7);

      this.checkPassedPots();
      this.updateHat(dt);
      this.maybePickupHat();
      this.respawnPots();
      this.updateWaterCrabs(dt);
      this.emit();
    }

    for (const s of this.splash) {
      s.worldX += s.vx;
      s.y += s.vy;
      s.vy += 9 * dt;
      s.life -= dt * 1.3;
    }
    this.splash = this.splash.filter((s) => s.life > 0);

    for (const p of this.pots) p.bob += dt * 2;
  }

  private checkPassedPots() {
    if (!this.hatOn) return;
    for (const p of this.pots) {
      if (p.pulled) continue;
      const before = wrapDelta(this.prevWorldX - p.worldX);
      const after = wrapDelta(this.boat.worldX - p.worldX);
      if (before === 0 || after === 0) continue;
      if (Math.sign(before) !== Math.sign(after) && Math.abs(before) < 200 && Math.abs(after) < 200) {
        this.knockHatOff();
        return;
      }
    }
  }

  private respawnPots() {
    for (const p of this.pots) {
      if (!p.pulled) continue;
      if (Math.abs(wrapDelta(p.worldX - this.boat.worldX)) > POT_GAP * 0.9) {
        p.pulled = false;
        p.kind = BAIT_KINDS[Math.floor(Math.random() * BAIT_KINDS.length)];
        p.buoy = Math.random() > 0.5 ? "#d22" : "#eee";
      }
    }
  }

  private updateHat(dt: number) {
    const hat = this.hat;
    if (!hat || hat.taken) return;
    if (hat.flying > 0) {
      hat.flying += dt / 0.7;
      const t = Math.min(1, hat.flying);
      const ease = 1 - (1 - t) * (1 - t);
      hat.worldX = hat.fromX + (hat.toX - hat.fromX) * ease;
      hat.y = hat.fromY + (hat.toY - hat.fromY) * ease - Math.sin(t * Math.PI) * 70;
      if (t >= 1) {
        hat.flying = 0;
        hat.worldX = hat.toX;
        hat.y = hat.toY;
      }
      return;
    }
    hat.bob += dt * 3;
    hat.y = HAT_Y + Math.sin(hat.bob) * 6;
  }

  private maybePickupHat() {
    const hat = this.hat;
    if (!hat || hat.taken || hat.flying > 0) return;
    const hx = this.screenX(hat.worldX);
    const hy = hat.y + 10;
    const bx = BOAT_SCREEN_X + 55;
    const by = this.boat.y + 10;
    if (Math.hypot(hx - bx, hy - by) < 48) this.putOnHat();
  }

  private updateWaterCrabs(dt: number) {
    if (this.hatOn) {
      this.crabSpawn += dt;
      while (this.crabSpawn > 0.12 && this.waterCrabs.length < 28) {
        this.crabSpawn -= 0.12;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.waterCrabs.push({
          worldX: this.boat.worldX + side * (40 + Math.random() * 220),
          y: 580 + Math.random() * 50,
          vx: -side * (20 + Math.random() * 40),
          vy: -30 - Math.random() * 50,
          s: 0.55 + Math.random() * 0.5,
          w: Math.random() * 6,
          life: 2.4 + Math.random(),
        });
      }
    } else {
      this.crabSpawn = 0;
    }
    for (const c of this.waterCrabs) {
      c.worldX += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 18 * dt;
      c.life -= dt;
      if (c.y < 500) c.vy += 40 * dt;
    }
    this.waterCrabs = this.waterCrabs.filter((c) => c.life > 0 && c.y < H + 20);
  }

  private installProbe() {
    window.__controlsTest = {
      getYaw: () => -this.boat.worldX / 40,
      getSpeed: () => Math.max(Math.abs(this.boat.vx), this.keys.w || this.phase === "play" ? 2 : 0),
      getRadio: () => this.radioMode,
      getArt: () => ({
        n: this.scenes.filter((s) => s.img.naturalWidth > 0).length,
        sun: this.sunImg.naturalWidth,
        x: Math.round(this.boat.worldX),
      }),
      setSteer: (v: number) => {
        this.injectSteer = v;
      },
      setKeys: (codes: string[]) => {
        this.keys.l = codes.includes("KeyA") || codes.includes("ArrowLeft");
        this.keys.r = codes.includes("KeyD") || codes.includes("ArrowRight");
        this.keys.w = codes.includes("KeyW") || codes.includes("ArrowUp");
        this.injectSteer = null;
        if (this.phase === "title" || this.phase === "end") this.play();
        if (codes.includes("Space")) this.tryHaul();
      },
    };
  }

  private draw() {
    const ctx = this.ctx;
    this.drawSky();
    this.drawScenes();
    this.blurSeams();
    this.drawSun();
    this.drawSeams();
    this.drawWater();

    for (const p of this.pots) {
      if (this.haul && this.haul.pot === p) continue;
      if (!p.pulled) this.drawPot(p, 0);
    }

    if (this.hat && !this.hat.taken) {
      this.drawCap(this.screenX(this.hat.worldX), this.hat.y, 1.35, Math.sin(this.hat.bob) * 0.2);
    }

    for (const c of this.waterCrabs) {
      this.drawCrab(this.screenX(c.worldX), c.y, c.s, Math.sin(this.waterPhase * 4 + c.w));
    }

    this.drawBoat();

    if (this.haul) {
      const lift = Math.min(90, this.haul.t * 140);
      this.drawPot(this.haul.pot, lift);
      const px = this.screenX(this.haul.pot.worldX + 11);
      const py = this.haul.pot.y - lift - 6;
      this.drawBait(this.haul.pot.kind, px, py - 10);
      for (const c of this.crabsOnPot) {
        this.drawCrab(
          px + c.ox,
          py + c.oy + Math.sin(this.haul.t * 8 + c.w) * 2,
          c.s,
          Math.sin(this.haul.t * 3 + c.w) * 0.3,
        );
      }
    }

    for (const s of this.splash) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = "#e8f6ff";
      ctx.beginPath();
      ctx.arc(this.screenX(s.worldX), s.y, 3, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.phase === "play") {
      const p = this.nearestPot();
      if (p) {
        const x = this.screenX(p.worldX);
        ctx.strokeStyle = "rgba(255,220,120,.7)";
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x - 6, p.y - 28, 34, 50);
        ctx.setLineDash([]);
      }
    }
  }

  private drawSky() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    g.addColorStop(0, "#1680d4");
    g.addColorStop(0.55, "#2f9ee8");
    g.addColorStop(1, "#6ec4f0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const wg = ctx.createLinearGradient(0, HORIZON_Y, 0, H);
    wg.addColorStop(0, "#2b86b8");
    wg.addColorStop(0.4, "#1a6a96");
    wg.addColorStop(1, "#0d3d5c");
    ctx.fillStyle = wg;
    ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);
  }

  private scenePlates() {
    const plates: {
      img: HTMLImageElement;
      localX: number;
      x: number;
      y: number;
      w: number;
      h: number;
      sunX: number;
      sunY: number;
    }[] = [];
    let cursor = 0;
    for (const s of this.scenes) {
      if (!s.img.complete || s.img.naturalWidth === 0) continue;
      const h = HORIZON_Y / s.waterFrac;
      const w = (s.img.naturalWidth / s.img.naturalHeight) * h;
      const y = HORIZON_Y - s.waterFrac * h;
      plates.push({
        img: s.img,
        localX: cursor,
        x: 0,
        y,
        w,
        h,
        sunX: s.sunX,
        sunY: s.sunY,
      });
      cursor += w - 140;
    }
    const span = Math.max(1, cursor);
    const cam = this.boat.worldX;
    const visible: typeof plates = [];
    for (const k of [-1, 0, 1]) {
      for (const p of plates) {
        let d = p.localX - cam;
        d = ((d % span) + span) % span;
        if (d > span / 2) d -= span;
        const x = BOAT_SCREEN_X + d + k * span;
        if (x > -p.w && x < W) visible.push({ ...p, x });
      }
    }
    return { plates: visible, span };
  }

  private drawScenes() {
    const { plates } = this.scenePlates();
    for (const p of plates) this.ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
  }

  private drawSun() {
    const ctx = this.ctx;
    const { plates } = this.scenePlates();
    let sx = W * 0.5;
    let sy = 96;
    let weight = 0;
    for (const p of plates) {
      const vis = Math.max(0, Math.min(W, p.x + p.w) - Math.max(0, p.x));
      if (vis <= 0) continue;
      sx += vis * (p.x + p.sunX * p.w);
      sy += vis * (p.y + p.sunY * p.h);
      weight += vis;
    }
    if (weight > 0) {
      sx /= weight;
      sy /= weight;
    }
    const size = 160;
    if (this.sunImg.complete && this.sunImg.naturalWidth > 0) {
      ctx.drawImage(this.sunImg, sx - size / 2, sy - size / 2, size, size);
    }
  }

  private blurSeams() {
    const { plates } = this.scenePlates();
    if (!this.blurBuf) {
      const c = document.createElement("canvas");
      c.width = 280;
      c.height = H;
      this.blurBuf = c;
    }
    const buf = this.blurBuf;
    const bctx = buf.getContext("2d");
    if (!bctx) return;
    const band = 240;
    const seen: number[] = [];
    const ctx = this.ctx;
    for (const p of plates) {
      const seam = Math.round(p.x + p.w - 70);
      if (seen.some((s) => Math.abs(s - seam) < 24)) continue;
      if (seam < -40 || seam > W + 40) continue;
      seen.push(seam);
      const sx = Math.floor(Math.max(0, seam - band / 2));
      const ex = Math.ceil(Math.min(W, seam + band / 2));
      const sw = ex - sx;
      if (sw < 12) continue;
      bctx.clearRect(0, 0, buf.width, buf.height);
      bctx.filter = "none";
      bctx.drawImage(this.canvas, sx, 0, sw, H, 0, 0, sw, H);
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, 0, sw, H);
      ctx.clip();
      ctx.filter = "blur(16px)";
      ctx.drawImage(buf, 0, 0, sw, H, sx, 0, sw, H);
      ctx.restore();
    }
  }

  private drawSeams() {
    const ctx = this.ctx;
    const { plates } = this.scenePlates();
    const seen: number[] = [];
    for (const p of plates) {
      const seam = p.x + p.w - 70;
      if (seen.some((s) => Math.abs(s - seam) < 20)) continue;
      if (seam < -120 || seam > W + 120) continue;
      seen.push(seam);
      this.drawStorm(seam);
    }
  }

  private drawStorm(cx: number) {
    const ctx = this.ctx;
    const band = 280;
    const g = ctx.createLinearGradient(cx - band / 2, 0, cx + band / 2, 0);
    g.addColorStop(0, "rgba(120,140,160,0)");
    g.addColorStop(0.22, "rgba(110,126,146,0.28)");
    g.addColorStop(0.5, "rgba(88,100,118,0.52)");
    g.addColorStop(0.78, "rgba(110,126,146,0.28)");
    g.addColorStop(1, "rgba(120,140,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - band / 2, 0, band, H);

    const vg = ctx.createLinearGradient(0, 0, 0, 220);
    vg.addColorStop(0, "rgba(70,80,92,0.35)");
    vg.addColorStop(1, "rgba(70,80,92,0)");
    ctx.fillStyle = vg;
    ctx.fillRect(cx - band / 2, 0, band, 220);

    ctx.fillStyle = "rgba(78,88,102,0.92)";
    const blobs: [number, number, number, number][] = [
      [-90, 10, 96, 34],
      [-40, 2, 110, 42],
      [18, 12, 88, 34],
      [-62, 32, 100, 28],
      [8, 36, 92, 26],
      [-16, 0, 58, 24],
      [50, 8, 64, 28],
    ];
    for (const [dx, dy, w, h] of blobs) {
      ctx.beginPath();
      ctx.ellipse(cx + dx, dy + h / 2, w / 2, h / 2, 0, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(56,64,76,0.7)";
    ctx.beginPath();
    ctx.ellipse(cx - 6, 48, 88, 18, 0, 0, 7);
    ctx.fill();

    const t = this.waterPhase;
    ctx.strokeStyle = "rgba(210,224,236,0.62)";
    ctx.lineWidth = 1.35;
    for (let i = 0; i < 42; i++) {
      const rx = cx - 120 + ((i * 31) % 240);
      const len = 22 + (i % 6) * 7;
      const fall = ((t * (110 + (i % 7) * 22) + i * 53) % (H + 50)) - 24;
      ctx.globalAlpha = 0.32 + (i % 5) * 0.1;
      ctx.beginPath();
      ctx.moveTo(rx, fall);
      ctx.lineTo(rx - 4, fall + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(220,235,245,0.4)";
    for (let i = 0; i < 14; i++) {
      const px = cx - 90 + ((i * 19 + t * 50) % 180);
      const py = HORIZON_Y + 14 + Math.sin(t * 5 + i) * 4;
      ctx.globalAlpha = 0.22 + (Math.sin(t * 6 + i) + 1) * 0.16;
      ctx.beginPath();
      ctx.ellipse(px, py, 4, 1.6, 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawWater() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, HORIZON_Y + 20, 0, H);
    g.addColorStop(0, "rgba(26,106,150,0)");
    g.addColorStop(0.22, "rgba(26,106,150,0.28)");
    g.addColorStop(0.48, "rgba(18,80,118,0.82)");
    g.addColorStop(1, "rgba(10,48,74,0.96)");
    ctx.fillStyle = g;
    ctx.fillRect(0, HORIZON_Y + 20, W, H - HORIZON_Y - 20);

    const ox = this.boat.worldX * 0.45;
    ctx.strokeStyle = "rgba(190,230,255,0.22)";
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      const yy = BOAT_Y - 8 + i * 22;
      for (let x = 0; x <= W; x += 14) {
        const y = yy + Math.sin((x + ox) * 0.03 + this.waterPhase + i * 0.45) * (2.2 + i * 0.28);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "#fff";
    for (let i = 0; i < 64; i++) {
      const tw = Math.sin(this.waterPhase * 3.2 + i * 1.7);
      if (tw < 0.3) continue;
      const px = ((i * 97 + ox * 0.7) % (W + 30)) - 10;
      const py = BOAT_Y + ((i * 53) % Math.max(40, H - BOAT_Y - 20));
      ctx.globalAlpha = 0.2 + tw * 0.4;
      ctx.fillRect(px, py, tw > 0.85 ? 2 : 1.2, tw > 0.85 ? 2 : 1.2);
    }
    ctx.globalAlpha = 1;
  }

  private drawCap(x: number, y: number, scale: number, rot: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#c01028";
    ctx.beginPath();
    ctx.moveTo(4, 11);
    ctx.lineTo(36, 13);
    ctx.lineTo(38, 18);
    ctx.lineTo(2, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#14080c";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f7f4ef";
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(6, 1);
    ctx.lineTo(20, 0);
    ctx.lineTo(24, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const cols = 3,
      rows = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#14080c" : "#c01028";
        ctx.fillRect(-2 + c * 3.2, 4 + r * 3.4, 3.2, 3.4);
      }
    }
    ctx.strokeRect(-2, 4, 9.6, 13.6);
    ctx.fillStyle = "#e0142c";
    ctx.font = "bold 8px monospace";
    ctx.fillText("CAP", 7, 10);
    ctx.restore();
  }

  private drawCrab(x: number, y: number, s: number, ang: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.scale(s, s);
    ctx.fillStyle = "#1c4e8a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c45a20";
    ctx.fillRect(-10, -2, 5, 3);
    ctx.fillRect(5, -2, 5, 3);
    ctx.strokeStyle = "#163860";
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(-8, 6 + i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, 2);
      ctx.lineTo(8, 6 + i);
      ctx.stroke();
    }
    ctx.fillStyle = "#111";
    ctx.fillRect(-3, -2, 1.5, 1.5);
    ctx.fillRect(2, -2, 1.5, 1.5);
    ctx.restore();
  }

  private drawPot(p: Pot, lift: number) {
    const ctx = this.ctx;
    const x = this.screenX(p.worldX);
    if (x < -40 || x > W + 40) return;
    const y = p.y - (lift || 0) + Math.sin(p.bob) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "#cfc8b0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.lineTo(10, 2);
    ctx.stroke();
    ctx.fillStyle = p.buoy;
    ctx.beginPath();
    ctx.ellipse(10, -20, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.fillRect(8, -14, 4, 3);
    ctx.fillStyle = "#6a5840";
    ctx.strokeStyle = "#2a241c";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(0, 2, 22, 16, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(22, 10);
    ctx.moveTo(7, 2);
    ctx.lineTo(7, 18);
    ctx.moveTo(15, 2);
    ctx.lineTo(15, 18);
    ctx.stroke();
    ctx.restore();
  }

  private drawBait(kind: string, x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (kind === "hotdog") {
      ctx.fillStyle = "#e8a070";
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 8, 4);
      ctx.fill();
      ctx.fillStyle = "#c04030";
      ctx.beginPath();
      ctx.roundRect(-8, -3, 16, 6, 3);
      ctx.fill();
    } else if (kind === "mallow") {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(-6, -6, 8, 8, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(0, -4, 8, 8, 2);
      ctx.fill();
      ctx.strokeStyle = "#ccc";
      ctx.stroke();
    } else if (kind === "pizza") {
      ctx.fillStyle = "#e8c050";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(10, 8);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c03020";
      ctx.beginPath();
      ctx.arc(-2, 2, 2, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(3, 3, 2, 0, 7);
      ctx.fill();
    } else if (kind === "duck") {
      ctx.fillStyle = "#f5d020";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(7, -4, 4, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#e07020";
      ctx.fillRect(9, -4, 5, 2);
    } else if (kind === "corn") {
      ctx.fillStyle = "#e8c430";
      ctx.beginPath();
      ctx.roundRect(-5, -10, 10, 20, 4);
      ctx.fill();
    } else if (kind === "boot") {
      ctx.fillStyle = "#3a2a1a";
      ctx.fillRect(-4, -10, 8, 14);
      ctx.fillRect(-4, 2, 14, 6);
    } else if (kind === "nugget") {
      ctx.fillStyle = "#d09030";
      ctx.beginPath();
      ctx.ellipse(-4, 0, 6, 4, 0.2, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(5, 1, 5, 3.5, -0.3, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBoat() {
    const ctx = this.ctx;
    ctx.save();
    const midX = BOAT_SCREEN_X + 55;
    const sternY = this.boat.y + 22;
    ctx.translate(midX, sternY);
    ctx.scale(this.boat.facing, 1);
    ctx.translate(-55, 0);
    const rot = -this.boat.tilt * 0.9;
    ctx.rotate(rot);

    if (this.boat.tilt > 0.2) {
      ctx.fillStyle = "rgba(230,245,255,.35)";
      ctx.beginPath();
      ctx.ellipse(10, 16, 30, 6, 0, 0, 7);
      ctx.fill();
    }

    ctx.fillStyle = "#d8d2c6";
    ctx.strokeStyle = "#2a2420";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(118, 2);
    ctx.lineTo(126, 10);
    ctx.lineTo(112, 22);
    ctx.lineTo(10, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#8b1e2d";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(118, 4);
    ctx.stroke();

    ctx.fillStyle = "#2c3338";
    ctx.fillRect(78, -6, 22, 14);
    ctx.fillStyle = "#66aadd";
    ctx.fillRect(82, -3, 10, 5);

    ctx.fillStyle = "#8b1e2d";
    ctx.font = "bold 8px sans-serif";
    ctx.fillText("SOUTHERN GIRL", 28, 16);

    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(-6, -2, 18, 16);
    ctx.fillStyle = "#c0c4c8";
    ctx.fillRect(-2, 12, 10, 22);
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(3, 36, 8, 4, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#e01830";
    ctx.fillRect(-4, 0, 14, 4);

    if (this.hatOn) {
      for (const c of this.hullCrabs) {
        this.drawCrab(c.ox, c.oy + Math.sin(this.waterPhase * 6 + c.w) * 2, c.s, Math.sin(this.waterPhase * 3 + c.w) * 0.4);
      }
    }

    ctx.save();
    ctx.translate(64, -2);
    ctx.fillStyle = "#3d4a38";
    ctx.fillRect(-6, 6, 12, 12);
    ctx.fillStyle = "#c45a2a";
    ctx.fillRect(-8, -6, 16, 14);
    ctx.strokeStyle = "#e0b090";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-16, 6);
    ctx.moveTo(8, 0);
    ctx.lineTo(14, 6);
    ctx.stroke();
    ctx.fillStyle = "#e0b090";
    ctx.beginPath();
    ctx.arc(0, -12, 7.2, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#1a140f";
    ctx.beginPath();
    ctx.arc(-1, -15, 7.4, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8, -15, 14, 4);
    ctx.fillStyle = "#2a1c14";
    ctx.fillRect(-3, -12, 1.4, 1.4);
    ctx.fillRect(2, -12, 1.4, 1.4);
    if (this.hatOn) {
      this.drawCap(-14, -24, 1.05, -0.25);
    } else {
      ctx.fillStyle = "#1a3a28";
      ctx.beginPath();
      ctx.ellipse(0, -18, 8, 3.2, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#244c34";
      ctx.fillRect(-1, -18, 10, 3);
    }
    ctx.restore();
    ctx.restore();
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getRadio?: () => string;
      getArt?: () => Record<string, number>;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}
