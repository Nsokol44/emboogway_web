/* What We Left in The Hills — game engine.
   A third-person survival escape in one Appalachian holler, built on
   Three.js primitives only (no external assets). The sim is plain TS;
   React reads a HUD snapshot a few times a second and calls methods back.

   The trade, in numbers: pack weight cuts your speed and grows your noise
   ring. Monsters hunt the ring and their eyes. Fog hides you and hurts you.
   The clock is nightfall. */

import * as THREE from "three";
import { HillsAudio } from "./audio";
import { TOTAL_WEIGHT, freshHaul, heaviestOf, type CarriedItem } from "./loot";
import type { DifficultyId, PerkId } from "./progression";

export const RUN_SECONDS = 420; // seven minutes to nightfall

const START_Z = -84;
const EXIT_Z = 100;
const FOG_THICK = 0.02; // density at which the fog starts working on you

/* ── small math helpers ─────────────────────────────────────────────── */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function sstep(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
function smoothNoise(x: number, z: number) {
  return (
    Math.sin(x * 0.11 + z * 0.07) * 0.5 +
    Math.sin(x * 0.043 - z * 0.091 + 2.1) * 0.8 +
    Math.sin((x + z) * 0.021 + 4.2) * 0.6
  );
}

/* ── the holler ─────────────────────────────────────────────────────── */
export function pathX(z: number) {
  return 7 * Math.sin(z * 0.016) + 3 * Math.sin(z * 0.041 + 1.3);
}
export function creekX(z: number) {
  return -13 + 4 * Math.sin(z * 0.021 + 0.6);
}
export const TUNNEL_X = 34;
export function railX(z: number) {
  return TUNNEL_X + 2 * Math.sin(z * 0.03 + 0.4);
}
export function shortcutX(z: number) {
  return -31 + 2 * Math.sin(z * 0.035);
}
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function terrainHeight(x: number, z: number): number {
  let h = 0.85 * Math.sin(z * 0.045 + 1.7) * Math.cos(x * 0.06) + 0.55 * smoothNoise(x * 0.6, z * 0.6) * 0.4;
  const ax = Math.abs(x);
  const t = sstep(22, 52, ax);
  h += t * t * 30 + sstep(48, 95, ax) * 34;
  // north wall across the exit end, with county-road and rail-tunnel gaps
  const gap = sstep(3.5, 9.5, Math.min(Math.abs(x - pathX(104)), Math.abs(x - railX(104))));
  h += sstep(94, 109, z) * 27 * gap;
  // south wall behind the start
  h += sstep(-95, -110, z) * 24;
  h += sstep(112, 130, z) * 10;
  // Two authored route benches cut through the ridges: the rail bed on the
  // east side (long, quiet, exposed) and the fallen-tree shortcut west.
  if (z > 24) {
    const d = Math.abs(x - railX(z));
    const blend = 1 - sstep(2.5, 8.5, d);
    const target = 1.0 + sstep(24, 104, z) * 2.4;
    h = lerp(h, target, blend * 0.94);
  }
  if (z > 6 && z < 70) {
    const d = Math.abs(x - shortcutX(z));
    const blend = (1 - sstep(2.5, 8.5, d)) * sstep(6, 14, z) * (1 - sstep(62, 70, z));
    const target = 1.0 + sstep(6, 70, z) * 1.1;
    h = lerp(h, target, blend * 0.92);
  }
  return h;
}
function terrainSlope(x: number, z: number): number {
  const e = 0.6;
  const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

/* ── shared types with the React shell ──────────────────────────────── */
export type Phase = "idle" | "playing" | "ended";
export type OutcomeKind = "escaped" | "caught" | "nightfall";
export type MonsterState = "unaware" | "curious" | "hunting" | "chasing";
export type ZoneId = "hollow" | "ridge" | "creek" | "homestead" | "rail";
export type RouteEventId = "fallen-tree" | "flooded-creek" | "washed-road";
export type DetectionCause = "noise" | "sight" | "fog churn" | "coin burst" | "fiddle";
export interface RunConfig {
  seed: string;
  difficulty: DifficultyId;
  perkId: PerkId | null;
  reducedHallucinations: boolean;
  soundIndicator: boolean;
}
export const DEFAULT_RUN_CONFIG: RunConfig = {
  seed: "standard-run",
  difficulty: "standard",
  perkId: null,
  reducedHallucinations: false,
  soundIndicator: true,
};
export const ROUTE_EVENT_LINES: Record<RouteEventId, string> = {
  "fallen-tree": "A fallen tree blocks the ridge shortcut.",
  "flooded-creek": "The creek is high — splashing will carry.",
  "washed-road": "The road is washed out — the path is slow going.",
};
export const ZONE_LINES: Record<ZoneId, string> = {
  hollow: "HOLLOW — the fog gathers thick here",
  ridge: "RIDGE — clearer air, longer way round",
  creek: "CREEK — quick ground, loud splashing",
  homestead: "HOMESTEAD — somebody else’s shelter, somebody else’s story",
  rail: "RAIL BED — quiet stone underfoot, long way round",
};
export interface LeftItem {
  name: string;
  value: number;
  weightKg: number;
}
export interface Outcome {
  kind: OutcomeKind;
  value: number;
  carried: LeftItem[];
  leftBehind: LeftItem[];
  secondsUsed: number;
  exitUsed: string | null;
  gaveAway: string | null;
  loudestMoment: string;
  peakNoise: number;
  routeEvent: RouteEventId;
  seed: string;
}
export interface HudSnapshot {
  phase: Phase;
  timeLeft: number;
  totalTime: number;
  carried: { uid: number; id: string; name: string; value: number; weightKg: number; quirk: string; wrapped: boolean; origin: string }[];
  carriedValue: number;
  carriedWeight: number;
  heaviestName: string | null;
  heaviestWeight: number;
  gait: "walk" | "hustle";
  noiseRadius: number;
  fogThick: boolean;
  caption: string;
  captionBearingDeg: number | null; // relative to camera, deg, 0 = ahead, + = right
  captionCloseness: number; // 0..1
  statusLine: string;
  statusAt: number;
  outcome: Outcome | null;
  zone: ZoneId;
  zoneLine: string;
  seed: string;
  difficulty: DifficultyId;
  perkId: PerkId | null;
  routeEvent: RouteEventId | null;
  routeEventLine: string | null;
  shortcutCleared: boolean;
  fallenTreeActive: boolean;
  nearFallenTree: boolean;
  lanternLit: boolean;
  monsterState: MonsterState;
  soundLevel: number;
  soundBearingDeg: number | null;
}

interface Monster {
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  state: MonsterState;
  temperament: "patient" | "bold" | "deaf";
  awareness: number;
  searchTimer: number;
  ignoreUntil: number;
  lastDetectionCause: DetectionCause | null;
  waypoint: THREE.Vector3;
  heard: THREE.Vector3 | null;
  lastSeen: THREE.Vector3 | null;
  loseTimer: number;
  waitTimer: number;
  phase: number;
  voice: number;
  wasChasing: boolean;
}
interface Phantom {
  group: THREE.Group;
  mats: THREE.MeshBasicMaterial[];
  active: boolean;
  life: number;
  lookTime: number;
}
interface DroppedLoot {
  item: CarriedItem;
  mesh: THREE.Group;
  lureUntil?: number;
  /** an item only becomes pickable again once you've stepped clear of it —
      otherwise the drop (1.6 out) sits inside the pickup radius and the
      pack silently re-swallows it on the next frame */
  armed: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);

export class HillsEngine {
  private container: HTMLElement;
  private onHud: (h: HudSnapshot) => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;

  readonly audio = new HillsAudio();

  phase: Phase = "idle";
  private paused = false;
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private fog!: THREE.FogExp2;
  private skyDay = new THREE.Color(0xaebfa8);
  private skyDusk = new THREE.Color(0x3a3040);
  private sunDay = new THREE.Color(0xffdfae);
  private sunDusk = new THREE.Color(0xe2703a);

  // player
  private player = new THREE.Group();
  private packMesh!: THREE.Mesh;
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private playerPos = new THREE.Vector3();
  private playerVel = new THREE.Vector3();
  private facing = 0;
  private walkPhase = 0;
  private camYaw = 0;
  private camPitch = 0.32;
  private camPos = new THREE.Vector3(0, 8, -20);

  // input
  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private hustleToggle = false;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  // run state
  private carried: CarriedItem[] = [];
  private dropped: DroppedLoot[] = [];
  private timeLeft = RUN_SECONDS;
  private elapsed = 0;
  private fogTime = 0;
  private fogDensity = 0.008;
  private fogOverride: number | null = null;
  private fogThick = false;
  private noiseRadius = 0;
  private gait: "walk" | "hustle" = "walk";
  private outcome: Outcome | null = null;

  private monsters: Monster[] = [];
  private phantoms: Phantom[] = [];
  private phantomTimer = 6;
  private falseGrowlTimer = 9;
  private caption = "";
  private captionBearing: number | null = null;
  private captionCloseness = 0;
  private captionTimer = 0;
  private falseCaptionUntil = 0;
  private statusLine = "";
  private statusAt = 0;
  private hudTimer = 0;
  private colliders: { x: number; z: number; r: number; id?: string }[] = [];
  private runConfig: RunConfig = { ...DEFAULT_RUN_CONFIG };
  private runDuration = RUN_SECONDS;
  private routeEvent: RouteEventId = "washed-road";
  private zone: ZoneId = "hollow";
  private wrappedUids = new Set<number>();
  private lanternLit = false;
  private lanternLight: THREE.PointLight | null = null;
  private shortcutCleared = false;
  private fallenTreeGroup: THREE.Group | null = null;
  private routeSignGroup: THREE.Group | null = null;
  private peakNoise = 0;
  private loudestMoment = "You never made a sound worth remembering.";
  private lastDetectionText: string | null = null;
  private secondWindUsed = false;
  private graceUntil = -1;
  private fogWarnedCycle = -1;
  private activeDecoy: { pos: THREE.Vector3; until: number; radius: number } | null = null;
  private soundLevel = 0;
  private soundBearing: number | null = null;
  private nearestMonsterState: MonsterState = "unaware";
  private lootLayout: Record<string, string> = {};
  private ring!: THREE.Mesh;
  private ringFill!: THREE.Mesh;
  private rng = mulberry32(20261027);

  constructor(container: HTMLElement, onHud: (h: HudSnapshot) => void) {
    this.container = container;
    this.onHud = onHud;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 420);
    this.buildWorld();
    this.resetRun(false);
    this.bindInput();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    (window as unknown as { __hills?: HillsEngine }).__hills = this;
    this.clock.start();
    /* Fixed-substep simulation: the sim advances in 1/60 steps however fast
       frames arrive, so a slow renderer (or a busy phone) slows the PICTURE,
       never the game clock. Capped so a long stall can't spiral. */
    let acc = 0;
    const STEP = 1 / 60;
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      acc += Math.min(this.clock.getDelta(), 1.0);
      let n = 0;
      while (acc >= STEP && n < 40) {
        this.step(STEP);
        acc -= STEP;
        n++;
      }
      if (n === 40) acc = 0;
      this.renderer.render(this.scene, this.camera);
    };
    loop();
    this.emitHud();
  }

  /* ═══════════════ world building ═══════════════ */

  private buildWorld() {
    const scene = this.scene;
    this.fog = new THREE.FogExp2(0xaebfa8, 0.008);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0xaebfa8);

    this.hemi = new THREE.HemisphereLight(0xbcd3e8, 0x2c3a24, 0.55);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffdfae, 2.4);
    this.sun.position.set(-40, 70, -30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 120;
    this.sun.shadow.camera.bottom = -120;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun);
    scene.add(this.sun.target);

    /* terrain */
    const SEG = 150;
    const geo = new THREE.PlaneGeometry(300, 300, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    const grassA = new THREE.Color(0x2e4d23);
    const grassB = new THREE.Color(0x55702f);
    const rock = new THREE.Color(0x5d6058);
    const dirt = new THREE.Color(0x8a7350);
    const wet = new THREE.Color(0x39525b);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const n = 0.5 + 0.5 * smoothNoise(x * 0.35, z * 0.35);
      c.copy(grassA).lerp(grassB, n);
      if (h > 9) c.lerp(rock, sstep(9, 22, h) * 0.8);
      const dp = Math.abs(x - pathX(z));
      if (dp < 2.6) c.lerp(dirt, (1 - dp / 2.6) * 0.85);
      const dc = Math.abs(x - creekX(z));
      if (dc < 1.6) c.lerp(wet, (1 - dc / 1.6) * 0.7);
      if (z > 24 && Math.abs(x - railX(z)) < 2.3) c.lerp(new THREE.Color(0x3f3d38), 0.72);
      if (z > 6 && z < 70 && Math.abs(x - shortcutX(z)) < 2.4) c.lerp(dirt, 0.45);
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    );
    terrain.receiveShadow = true;
    scene.add(terrain);

    /* creek ribbon */
    {
      const pts: number[] = [];
      const idx: number[] = [];
      let vi = 0;
      for (let z = -104; z <= 108; z += 4) {
        const cx = creekX(z);
        for (const s of [-1.15, 1.15]) {
          const x = cx + s;
          pts.push(x, terrainHeight(x, z) + 0.07, z);
        }
        if (vi >= 2) {
          const a = vi - 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        vi += 2;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const creek = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color: 0x41626e, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 })
      );
      scene.add(creek);
    }

    this.scatterNature();
    this.buildHomestead();
    this.buildExit();
    this.buildRailTunnel();
    this.buildPlayer();
    this.buildMonsters();
    this.buildPhantoms();

    /* noise ring — the sound you make, drawn on the ground */
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fe7d2, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 56), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 5;
    scene.add(this.ring);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0x7fe7d2, transparent: true, opacity: 0.06, depthWrite: false });
    this.ringFill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), fillMat);
    this.ringFill.rotation.x = -Math.PI / 2;
    this.ringFill.renderOrder = 4;
    scene.add(this.ringFill);
  }

  private scatterNature() {
    const rng = mulberry32(977351);
    const trunkG = new THREE.CylinderGeometry(0.13, 0.22, 1.7, 6);
    const canopyG = new THREE.ConeGeometry(1.35, 3.4, 7);
    const rockG = new THREE.DodecahedronGeometry(0.75);
    const bushG = new THREE.IcosahedronGeometry(0.95, 0);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x4c3a28, roughness: 1 });
    const canopyM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const rockM = new THREE.MeshStandardMaterial({ color: 0x63665e, roughness: 1 });
    const bushM = new THREE.MeshStandardMaterial({ color: 0x22391c, roughness: 1 });

    const spots: { x: number; z: number; s: number }[] = [];
    const clearOf = (x: number, z: number) => {
      if (Math.abs(x - pathX(z)) < 3.4) return false;
      if (Math.abs(x - creekX(z)) < 2.6) return false;
      if (Math.hypot(x - pathX(START_Z), z - START_Z) < 6) return false;
      const hx = pathX(-76) + 10;
      if (Math.hypot(x - hx, z + 76) < 9) return false;
      if (Math.hypot(x - pathX(104), z - EXIT_Z) < 8) return false;
      return true;
    };
    let guard = 0;
    while (spots.length < 135 && guard++ < 4000) {
      const x = (rng() * 2 - 1) * 58;
      const z = -102 + rng() * 206;
      if (!clearOf(x, z)) continue;
      if (terrainSlope(x, z) > 1.15) continue;
      spots.push({ x, z, s: 0.8 + rng() * 0.9 });
    }
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, spots.length);
    const canopies = new THREE.InstancedMesh(canopyG, canopyM, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    spots.forEach((sp, i) => {
      const y = terrainHeight(sp.x, sp.z);
      q.setFromAxisAngle(UP, rng() * Math.PI * 2);
      m.compose(new THREE.Vector3(sp.x, y + 0.8 * sp.s, sp.z), q, new THREE.Vector3(sp.s, sp.s, sp.s));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(sp.x, y + (1.7 + 1.6) * sp.s, sp.z), q, new THREE.Vector3(sp.s, sp.s * (0.9 + rng() * 0.4), sp.s));
      canopies.setMatrixAt(i, m);
      col.setHSL(0.29 + rng() * 0.05, 0.42, 0.2 + rng() * 0.1);
      canopies.setColorAt(i, col);
      this.colliders.push({ x: sp.x, z: sp.z, r: 0.42 * sp.s });
    });
    trunks.castShadow = true;
    canopies.castShadow = true;
    this.scene.add(trunks, canopies);

    const rocks: { x: number; z: number; s: number }[] = [];
    guard = 0;
    while (rocks.length < 44 && guard++ < 3000) {
      const x = (rng() * 2 - 1) * 62;
      const z = -102 + rng() * 206;
      if (!clearOf(x, z)) continue;
      rocks.push({ x, z, s: 0.5 + rng() * 1.3 });
    }
    const rockMesh = new THREE.InstancedMesh(rockG, rockM, rocks.length);
    rocks.forEach((r, i) => {
      const y = terrainHeight(r.x, r.z);
      q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3));
      m.compose(new THREE.Vector3(r.x, y + 0.15, r.z), q, new THREE.Vector3(r.s, r.s * 0.75, r.s));
      rockMesh.setMatrixAt(i, m);
      this.colliders.push({ x: r.x, z: r.z, r: 0.6 * r.s });
    });
    rockMesh.castShadow = true;
    this.scene.add(rockMesh);

    const bushes: { x: number; z: number; s: number }[] = [];
    guard = 0;
    while (bushes.length < 64 && guard++ < 3000) {
      const x = (rng() * 2 - 1) * 50;
      const z = -102 + rng() * 206;
      if (Math.abs(x - pathX(z)) < 2.6) continue;
      if (Math.abs(x - creekX(z)) < 2) continue;
      if (terrainSlope(x, z) > 1.2) continue;
      bushes.push({ x, z, s: 0.7 + rng() * 1.1 });
    }
    const bushMesh = new THREE.InstancedMesh(bushG, bushM, bushes.length);
    bushes.forEach((b, i) => {
      const y = terrainHeight(b.x, b.z);
      q.setFromAxisAngle(UP, rng() * Math.PI * 2);
      m.compose(new THREE.Vector3(b.x, y + 0.4 * b.s, b.z), q, new THREE.Vector3(b.s, b.s * 0.62, b.s));
      bushMesh.setMatrixAt(i, m);
    });
    this.scene.add(bushMesh);
  }

  private buildHomestead() {
    const g = new THREE.Group();
    const hx = pathX(-76) + 10;
    const hz = -76;
    const hy = terrainHeight(hx, hz);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6e5942, roughness: 1 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 });
    const add = (mesh: THREE.Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 5.2), woodDark), 0, 0.15, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.4, 0.25), wood), 0, 1.45, -2.5); // back wall
    add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 5.2), wood), -3.1, 1.45, 0); // side wall
    add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 0.25), wood), -1.8, 1.45, 2.5); // front, partial
    add(new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 3.4), woodDark), -1.2, 3.1, -0.9, 0, 0, 0.5); // roof, half-fallen
    add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 3.1), woodDark), 2.4, 1.1, 0.9, 0.2, 0.4, -0.9); // roof slab on the ground
    const barrel = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10), new THREE.MeshStandardMaterial({ color: 0x5d4630, roughness: 0.9 })), 4.3, 0.55, 1.8);
    barrel.castShadow = true;
    // fence posts wandering toward the path
    for (let i = 0; i < 5; i++) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.1, 5), woodDark), -5.5 - i * 0.4, 0.5, -1.5 + i * 1.35, 0.06 * i, 0, 0.05);
    }
    g.position.set(hx, hy, hz);
    g.rotation.y = 0.5;
    this.scene.add(g);
    this.colliders.push({ x: hx, z: hz, r: 3.4 });
  }

  private signTexture(): THREE.Texture {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 256;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#38291a";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#c9b48a";
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 484, 228);
    ctx.fillStyle = "#efe3c2";
    ctx.textAlign = "center";
    ctx.font = "bold 74px Georgia, serif";
    ctx.fillText("COUNTY", 256, 100);
    ctx.fillText("ROAD", 256, 182);
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText("→", 452, 238);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private textTexture(title: string, sub: string): THREE.Texture {
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 256;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#38291a";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#c9b48a";
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, 484, 228);
    ctx.fillStyle = "#efe3c2";
    ctx.textAlign = "center";
    ctx.font = "bold 52px Georgia, serif";
    ctx.fillText(title, 256, 104);
    ctx.font = "bold 31px Georgia, serif";
    const words = sub.split(" ");
    let line = "";
    let y = 158;
    for (const w of words) {
      if ((line + " " + w).trim().length > 24) {
        ctx.fillText(line.trim(), 256, y);
        y += 42;
        line = w;
      } else line += " " + w;
    }
    if (line.trim()) ctx.fillText(line.trim(), 256, y);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildRailTunnel() {
    const grp = new THREE.Group();
    const x = railX(103);
    const z = 103;
    const y = terrainHeight(x, z);
    const dark = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 1 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x555650, roughness: 1 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(7.6, 5.4, 1.2), dark);
    mouth.position.set(0, 2.45, 0);
    grp.add(mouth);
    for (const sx of [-4.15, 4.15]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, 5.8, 1.5), stone);
      pier.position.set(sx, 2.7, 0.1);
      pier.castShadow = true;
      grp.add(pier);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.0, 1.5), stone);
    lintel.position.set(0, 5.65, 0.1);
    grp.add(lintel);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.55, 0.12),
      new THREE.MeshStandardMaterial({ map: this.textTexture("RAIL TUNNEL", "THE LONG WAY OUT"), roughness: 0.9 })
    );
    board.position.set(-6.4, 2.6, 0.4);
    board.rotation.y = 0.35;
    grp.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.2, 6), stone);
    post.position.set(-6.4, 1.4, 0.4);
    grp.add(post);
    grp.position.set(x, y, z);
    this.scene.add(grp);
  }

  private buildExit() {
    const gx = pathX(104);
    const gz = EXIT_Z + 3;
    const gy = terrainHeight(gx, gz);
    const grp = new THREE.Group();
    const postM = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 });
    for (const s of [-1.5, 1.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 6), postM);
      post.position.set(s, 1.7, 0);
      post.castShadow = true;
      grp.add(post);
    }
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.7, 0.12),
      new THREE.MeshStandardMaterial({ map: this.signTexture(), roughness: 0.9 })
    );
    board.position.set(0, 2.75, 0);
    board.castShadow = true;
    grp.add(board);
    // lantern on the right post — the light you're walking toward
    const lampGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc978 })
    );
    lampGlass.position.set(1.5, 3.6, 0);
    grp.add(lampGlass);
    const lamp = new THREE.PointLight(0xffa040, 60, 30, 1.8);
    lamp.position.set(1.5, 3.6, 0);
    grp.add(lamp);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 4.1, 16, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
    );
    column.position.set(0, 7, 0);
    grp.add(column);
    grp.position.set(gx, gy, gz);
    this.scene.add(grp);
  }

  private limb(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): { pivot: THREE.Group; mesh: THREE.Mesh } {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return { pivot, mesh };
  }

  private buildPlayer() {
    const g = this.player;
    const cloth = new THREE.MeshStandardMaterial({ color: 0x74503a, roughness: 1 });
    const flannel = new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 1 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9a186, roughness: 0.9 });
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 1 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.3), flannel);
    torso.position.y = 1.08;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.3, 0.27), skin);
    head.position.y = 1.56;
    head.castShadow = true;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 8), cloth);
    cap.position.y = 1.74;
    g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), cloth);
    brim.position.set(0, 1.7, 0.2);
    g.add(brim);

    const legL = this.limb(0.17, 0.78, 0.19, cloth, -0.14, 0.78, 0);
    const legR = this.limb(0.17, 0.78, 0.19, cloth, 0.14, 0.78, 0);
    const armL = this.limb(0.13, 0.66, 0.15, flannel, -0.35, 1.36, 0);
    const armR = this.limb(0.13, 0.66, 0.15, flannel, 0.35, 1.36, 0);
    this.legL = legL.pivot;
    this.legR = legR.pivot;
    this.armL = armL.pivot;
    this.armR = armR.pivot;
    g.add(this.legL, this.legR, this.armL, this.armR);

    // THE pack — scales with what you're carrying
    this.packMesh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.36), canvasMat);
    this.packMesh.castShadow = true;
    const packGroup = new THREE.Group();
    packGroup.position.set(0, 1.12, -0.34);
    packGroup.add(this.packMesh);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.58, 8), new THREE.MeshStandardMaterial({ color: 0x5d6e46, roughness: 1 }));
    roll.rotation.z = Math.PI / 2;
    roll.position.y = 0.42;
    packGroup.add(roll);
    g.add(packGroup);
    (g as unknown as { __packGroup: THREE.Group }).__packGroup = packGroup;

    this.lanternLight = new THREE.PointLight(0xffa040, 0, 19, 1.7);
    this.lanternLight.position.set(0.38, 1.35, 0.42);
    g.add(this.lanternLight);

    this.scene.add(g);
  }

  private monsterFigure(): { group: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group } {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b0d0b, roughness: 1 });
    const legL = this.limb(0.15, 1.55, 0.17, mat, -0.17, 1.55, 0);
    const legR = this.limb(0.15, 1.55, 0.17, mat, 0.17, 1.55, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.15, 0.3), mat);
    torso.position.y = 2.1;
    torso.rotation.x = 0.14;
    torso.castShadow = true;
    g.add(torso);
    const armL = this.limb(0.12, 1.6, 0.14, mat, -0.4, 2.6, 0.05);
    const armR = this.limb(0.12, 1.6, 0.14, mat, 0.4, 2.6, 0.05);
    armL.pivot.rotation.x = 0.12;
    armR.pivot.rotation.x = 0.12;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.52, 0.3), mat);
    head.position.set(0, 2.98, 0.1);
    head.rotation.x = 0.22;
    head.castShadow = true;
    g.add(head);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x9c2718 });
    for (const s of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), eyeM);
      eye.position.set(s, 3.02, 0.26);
      g.add(eye);
    }
    g.add(legL.pivot, legR.pivot, armL.pivot, armR.pivot);
    return { group: g, legL: legL.pivot, legR: legR.pivot, armL: armL.pivot, armR: armR.pivot };
  }

  private buildMonsters() {
    const spawns: [number, number][] = [
      [pathX(-28) - 10, -28],
      [pathX(14) + 11, 14],
      [pathX(48) - 12, 48],
    ];
    spawns.forEach(([x, z], i) => {
      const f = this.monsterFigure();
      f.group.position.set(x, terrainHeight(x, z), z);
      this.scene.add(f.group);
      this.monsters.push({
        ...f,
        state: "unaware",
        temperament: "patient",
        awareness: 0,
        searchTimer: 0,
        ignoreUntil: -1,
        lastDetectionCause: null,
        waypoint: new THREE.Vector3(x, 0, z),
        heard: null,
        lastSeen: null,
        loseTimer: 0,
        waitTimer: 0,
        phase: i * 2.1,
        voice: -1,
        wasChasing: false,
      });
    });
  }

  private buildPhantoms() {
    for (let i = 0; i < 2; i++) {
      const f = this.monsterFigure();
      const mats: THREE.MeshBasicMaterial[] = [];
      f.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0 });
          o.material = m;
          o.castShadow = false;
          mats.push(m);
        }
      });
      f.group.visible = false;
      this.scene.add(f.group);
      this.phantoms.push({ group: f.group, mats, active: false, life: 0, lookTime: 0 });
    }
  }

  /* ═══════════════ input ═══════════════ */

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.phase === "playing" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onPointerDown = (e: PointerEvent) => {
    if (e.target !== this.renderer.domElement) return;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.camYaw -= dx * 0.0052;
    this.camPitch = clamp(this.camPitch + dy * 0.003, 0.08, 0.9);
  };
  private onPointerUp = () => {
    this.dragging = false;
  };

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.style.touchAction = "none";
  }

  /* ═══════════════ public controls (from React) ═══════════════ */

  setJoystick(x: number, y: number) {
    this.joy.x = x;
    this.joy.y = y;
  }
  setHustleToggle(b: boolean) {
    this.hustleToggle = b;
  }
  /** Freeze the run (tutorial reopened mid-run, tab hidden, …). */
  setPaused(b: boolean) {
    this.paused = b;
  }
  get isPaused() {
    return this.paused;
  }
  toggleHustle() {
    this.hustleToggle = !this.hustleToggle;
  }

  configureRun(config: Partial<RunConfig>) {
    this.runConfig = { ...this.runConfig, ...config };
    if (this.phase === "idle") this.resetRun(false);
  }

  get config(): RunConfig {
    return this.runConfig;
  }

  startRun() {
    this.audio.ensure();
    for (const mon of this.monsters) {
      if (mon.voice < 0) mon.voice = this.audio.makeVoice();
    }
    this.resetRun(true);
  }

  backToTitle() {
    this.resetRun(false);
    this.audio.silenceVoices();
  }

  dropHeaviest() {
    if (this.phase !== "playing") return;
    const h = heaviestOf(this.carried);
    if (h) this.dropItem(h.uid);
  }

  dropItem(uid: number) {
    if (this.phase !== "playing") return;
    const item = this.carried.find((i) => i.uid === uid);
    if (!item) return;
    const wasChased = this.monsters.some((m) => m.state === "chasing");
    this.placeDroppedItem(item, this.playerPos);
    if (item.id === "quilt") this.wrappedUids.clear();
    this.wrappedUids.delete(uid);
    if (item.id === "lantern") this.setLantern(false);
    if (item.id === "coins" && wasChased) {
      const pos = this.dropped[this.dropped.length - 1].mesh.position.clone();
      this.activeDecoy = { pos, until: this.elapsed + 5, radius: 34 };
      this.audio.coinClang();
      this.recordDetection("coin burst", `The burst coins pulled their attention to ${Math.round(this.activeDecoy.radius)} metres around the drop.`);
      this.setStatus("The coins burst — a bright, costly clang behind you.");
    } else {
      this.audio.thunk();
      this.setStatus(`Dropped the ${item.name.toLowerCase()} — quieter now.`);
    }
    this.updatePackVisual();
    this.emitHud();
  }

  private placeDroppedItem(item: CarriedItem, from: THREE.Vector3): DroppedLoot {
    this.carried = this.carried.filter((i) => i.uid !== item.uid);
    const mesh = this.makeLootMesh(item);
    const dropPos = from.clone();
    dropPos.x += Math.sin(this.facing) * -1.6 + (this.rng() - 0.5) * 0.5;
    dropPos.z += Math.cos(this.facing) * -1.6 + (this.rng() - 0.5) * 0.5;
    mesh.position.set(dropPos.x, terrainHeight(dropPos.x, dropPos.z) + 0.3, dropPos.z);
    this.scene.add(mesh);
    const dropped = { item, mesh, armed: false } satisfies DroppedLoot;
    this.dropped.push(dropped);
    return dropped;
  }

  wrapItem(uid: number) {
    if (this.phase !== "playing") return;
    if (!this.carried.some((i) => i.id === "quilt")) {
      this.setStatus("You need the patchwork quilt in your pack to wrap an item.");
      return;
    }
    const item = this.carried.find((i) => i.uid === uid);
    if (!item || item.id === "quilt") return;
    if (this.wrappedUids.has(uid)) {
      this.wrappedUids.delete(uid);
      this.setStatus(`Unwrapped the ${item.name.toLowerCase()} — it makes its full noise again.`);
    } else {
      const max = this.runConfig.perkId === "steady-hands" ? 2 : 1;
      if (this.wrappedUids.size >= max) {
        const oldest = this.wrappedUids.values().next().value as number;
        this.wrappedUids.delete(oldest);
      }
      this.wrappedUids.add(uid);
      this.setStatus(`Wrapped the ${item.name.toLowerCase()} in the quilt — its noise is halved.`);
    }
    this.emitHud();
  }

  playFiddle() {
    if (this.phase !== "playing") return;
    const fiddle = this.carried.find((i) => i.id === "fiddle");
    if (!fiddle) return;
    const dropped = this.placeDroppedItem(fiddle, this.playerPos);
    dropped.lureUntil = this.elapsed + 8;
    dropped.armed = false;
    this.audio.fiddleLure();
    this.recordDetection("fiddle", "The fiddle sounded where you left it, drawing nearby hunters for 8 seconds.");
    this.setStatus("The fiddle plays on behind you — nearby things go to the music.");
    this.updatePackVisual();
    this.emitHud();
  }

  toggleLantern() {
    if (this.phase !== "playing") return;
    if (!this.carried.some((i) => i.id === "lantern")) return;
    this.setLantern(!this.lanternLit);
    this.setStatus(this.lanternLit ? "Lantern lit — the fog’s tricks fade, but their sight reaches farther." : "Lantern snuffed — darker, and harder to see.");
    this.emitHud();
  }

  private setLantern(on: boolean) {
    this.lanternLit = on && this.carried.some((i) => i.id === "lantern");
    if (this.lanternLight) this.lanternLight.intensity = this.lanternLit ? 26 : 0;
    if (this.lanternLit) {
      for (const p of this.phantoms) {
        p.active = false;
        p.group.visible = false;
      }
    }
  }

  clearFallenTree() {
    if (this.phase !== "playing" || this.routeEvent !== "fallen-tree" || this.shortcutCleared) return;
    if (!this.carried.some((i) => i.id === "tools")) {
      this.setStatus("The iron tools could clear that tree — if you were carrying them.");
      return;
    }
    if (!this.isNearFallenTree()) {
      this.setStatus("Get to the fallen tree across the ridge shortcut to clear it.");
      return;
    }
    this.shortcutCleared = true;
    if (this.fallenTreeGroup) this.scene.remove(this.fallenTreeGroup);
    this.fallenTreeGroup = null;
    this.colliders = this.colliders.filter((c) => c.id !== "fallen-tree");
    this.setStatus("You clear the fallen tree — the ridge shortcut is open.");
    this.emitHud();
  }

  private isNearFallenTree(): boolean {
    return this.routeEvent === "fallen-tree" && Math.hypot(this.playerPos.x - shortcutX(38), this.playerPos.z - 38) < 5.5;
  }

  /* debug hooks for probes/captures */
  forceFog(density: number | null) {
    this.fogOverride = density;
  }
  teleport(x: number, z: number) {
    this.playerPos.set(x, terrainHeight(x, z), z);
  }
  debugState() {
    return {
      phase: this.phase,
      player: { x: +this.playerPos.x.toFixed(1), z: +this.playerPos.z.toFixed(1) },
      fog: +this.fogDensity.toFixed(4),
      fogThick: this.fogThick,
      carried: this.carried.length,
      dropped: this.dropped.length,
      noise: +this.noiseRadius.toFixed(1),
      timeLeft: Math.ceil(this.timeLeft),
      monsters: this.monsters.map((mm) => mm.state),
      monsterPos: this.monsters.map((mm) => ({ x: +mm.group.position.x.toFixed(1), z: +mm.group.position.z.toFixed(1) })),
      carriedItems: this.carried.map((i) => ({ id: i.id, uid: i.uid })),
      activeDecoy: !!this.activeDecoy,
      monsterStates: this.monsters.map((mm) => mm.state),
      temperaments: this.monsters.map((mm) => mm.temperament),
      zone: this.zone,
      routeEvent: this.routeEvent,
      seed: this.runConfig.seed,
      difficulty: this.runConfig.difficulty,
      perk: this.runConfig.perkId,
      lootLayout: this.lootLayout,
      wrapped: [...this.wrappedUids],
      lanternLit: this.lanternLit,
      shortcutCleared: this.shortcutCleared,
      peakNoise: +this.peakNoise.toFixed(1),
      loudestMoment: this.loudestMoment,
      totalTime: this.runDuration,
    };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    (window as unknown as { __hills?: HillsEngine }).__hills = undefined;
  }

  /* ═══════════════ run setup ═══════════════ */

  private makeLootMesh(item: CarriedItem): THREE.Group {
    const g = new THREE.Group();
    // a dropped thing should catch the eye: warm wood-and-brass tones
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.34, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xb08d4f, roughness: 0.55, metalness: 0.25 })
    );
    box.castShadow = true;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.07, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x6e5942, roughness: 0.9 })
    );
    lid.position.y = 0.2;
    g.add(box, lid);
    void item;
    return g;
  }

  private resetRun(start: boolean) {
    // clear dropped loot meshes
    for (const d of this.dropped) this.scene.remove(d.mesh);
    this.dropped = [];
    this.carried = freshHaul();
    const seedNumber = hashSeed(this.runConfig.seed || "standard-run");
    this.rng = mulberry32(seedNumber ^ 0x5f3759df);
    const layout = mulberry32(seedNumber);
    const events: RouteEventId[] = ["fallen-tree", "flooded-creek", "washed-road"];
    this.routeEvent = events[Math.floor(layout() * events.length)];
    this.lootLayout = this.makeLootLayout(layout);
    this.runDuration = this.runConfig.difficulty === "story" ? 480 : this.runConfig.difficulty === "ruthless" ? 360 : RUN_SECONDS;
    this.timeLeft = this.runDuration;
    this.elapsed = 0;
    this.fogTime = 0; // every run opens on the same clear holler
    this.outcome = null;
    this.phase = start ? "playing" : "idle";
    this.wrappedUids.clear();
    this.setLantern(false);
    this.lanternLit = false;
    this.shortcutCleared = false;
    this.activeDecoy = null;
    this.peakNoise = 0;
    this.loudestMoment = "You never made a sound worth remembering.";
    this.lastDetectionText = null;
    this.secondWindUsed = false;
    this.graceUntil = -1;
    this.fogWarnedCycle = -1;
    this.noiseRadius = 0;
    this.zone = this.zoneAt(pathX(START_Z), START_Z);
    this.playerPos.set(pathX(START_Z), 0, START_Z);
    this.playerPos.y = terrainHeight(this.playerPos.x, this.playerPos.z);
    this.facing = 0;
    this.camYaw = 0;
    this.player.position.copy(this.playerPos);
    this.player.rotation.y = 0;
    const spawns: [number, number][] = [
      [pathX(-28) - 10, -28],
      [pathX(14) + 11, 14],
      [pathX(48) - 12, 48],
    ];
    const temperaments: Monster["temperament"][] = ["patient", "bold", "deaf"];
    for (let i = temperaments.length - 1; i > 0; i--) {
      const j = Math.floor(layout() * (i + 1));
      [temperaments[i], temperaments[j]] = [temperaments[j], temperaments[i]];
    }
    this.monsters.forEach((mon, i) => {
      const [x, z] = spawns[i];
      mon.group.position.set(x, terrainHeight(x, z), z);
      mon.state = "unaware";
      mon.temperament = temperaments[i];
      mon.awareness = 0;
      mon.searchTimer = 0;
      mon.ignoreUntil = -1;
      mon.lastDetectionCause = null;
      mon.waypoint.set(x, 0, z);
      mon.heard = null;
      mon.lastSeen = null;
      mon.loseTimer = 0;
      mon.waitTimer = 0;
      mon.wasChasing = false;
    });
    for (const p of this.phantoms) {
      p.active = false;
      p.group.visible = false;
    }
    this.phantomTimer = 7;
    this.falseGrowlTimer = 11;
    this.caption = "";
    this.statusLine = start ? ROUTE_EVENT_LINES[this.routeEvent] : "";
    this.statusAt = performance.now();
    this.buildRouteFeatures();
    this.updatePackVisual();
    this.emitHud();
  }

  private makeLootLayout(layout: () => number): Record<string, string> {
    const bands: Record<string, { items: string[]; points: string[] }> = {
      high: { items: ["coins", "fiddle", "ginseng"], points: ["homestead cache", "hollow cache", "ridge grave cache"] },
      middle: { items: ["tools", "lantern", "kettle", "copper"], points: ["creek camp cache", "survey cache", "rail cache", "road cache"] },
      light: { items: ["quilt"], points: ["homestead clothesline"] },
    };
    const out: Record<string, string> = {};
    for (const band of Object.values(bands)) {
      const points = [...band.points];
      for (let i = points.length - 1; i > 0; i--) {
        const j = Math.floor(layout() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }
      band.items.forEach((id, i) => { out[id] = points[i]; });
    }
    return out;
  }

  private buildRouteFeatures() {
    if (this.routeSignGroup) this.scene.remove(this.routeSignGroup);
    if (this.fallenTreeGroup) this.scene.remove(this.fallenTreeGroup);
    this.routeSignGroup = null;
    this.fallenTreeGroup = null;
    this.colliders = this.colliders.filter((c) => c.id !== "fallen-tree");
    const titles: Record<RouteEventId, [string, string]> = {
      "fallen-tree": ["FALLEN TREE", "RIDGE SHORTCUT BLOCKED"],
      "flooded-creek": ["CREEK HIGH", "SPLASHING CARRIES"],
      "washed-road": ["ROAD WASHED", "THE PATH IS SLOW"],
    };
    const sign = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.1, 6), new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1 }));
    post.position.y = 1.45;
    sign.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.6, 0.12),
      new THREE.MeshStandardMaterial({ map: this.textTexture(titles[this.routeEvent][0], titles[this.routeEvent][1]), roughness: 0.9 })
    );
    board.position.y = 2.65;
    sign.add(board);
    const sx = pathX(-80) + 4.5;
    sign.position.set(sx, terrainHeight(sx, -80), -80);
    sign.rotation.y = -0.35;
    this.scene.add(sign);
    this.routeSignGroup = sign;

    if (this.routeEvent === "fallen-tree" && !this.shortcutCleared) {
      const grp = new THREE.Group();
      const bark = new THREE.MeshStandardMaterial({ color: 0x4c3826, roughness: 1 });
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 9.5, 9), bark);
      log.rotation.z = Math.PI / 2;
      log.position.y = 0.55;
      log.castShadow = true;
      grp.add(log);
      for (let i = 0; i < 5; i++) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.8, 6), bark);
        branch.position.set(-3.4 + i * 1.6, 1.05, (i % 2 ? 0.35 : -0.3));
        branch.rotation.set(0.7, 0, -0.55 + i * 0.22);
        grp.add(branch);
      }
      const tx = shortcutX(38);
      grp.position.set(tx, terrainHeight(tx, 38), 38);
      this.scene.add(grp);
      this.fallenTreeGroup = grp;
      for (const dx of [-3.2, 0, 3.2]) this.colliders.push({ x: tx + dx, z: 38, r: 1.65, id: "fallen-tree" });
    }
  }

  private updatePackVisual() {
    const g = (this.player as unknown as { __packGroup?: THREE.Group }).__packGroup;
    if (!g) return;
    const w = this.carried.reduce((s, i) => s + i.weightKg, 0);
    const s = 0.5 + 0.8 * (w / TOTAL_WEIGHT);
    g.scale.setScalar(s);
  }

  private setStatus(line: string) {
    this.statusLine = line;
    this.statusAt = performance.now();
  }

  private zoneAt(x: number, z: number): ZoneId {
    if (z > 24 && Math.abs(x - railX(z)) < 3.4) return "rail";
    const hx = pathX(-76) + 10;
    if (Math.hypot(x - hx, z + 76) < 13) return "homestead";
    if (Math.abs(x - creekX(z)) < 2.4) return "creek";
    if (Math.abs(x) >= 29 || (z > 6 && z < 70 && Math.abs(x - shortcutX(z)) < 5)) return "ridge";
    return "hollow";
  }

  private zoneFogFactor(zone: ZoneId): number {
    return zone === "hollow" ? 1.3 : zone === "ridge" ? 0.6 : zone === "rail" ? 0.8 : 1;
  }

  private noiseWeight(): number {
    let w = this.carried.reduce((sum, item) => sum + item.weightKg * (this.wrappedUids.has(item.uid) ? 0.5 : 1), 0);
    if (this.runConfig.perkId === "pack-mule") w = Math.max(0, w - 3);
    return w;
  }

  private recordDetection(cause: DetectionCause, text?: string) {
    const weight = this.carried.reduce((sum, i) => sum + i.weightKg, 0);
    const zoneWords = { hollow: "in the hollow", ridge: "on the ridge", creek: "in the creek", homestead: "by the homestead", rail: "on the rail bed" }[this.zone];
    const base =
      cause === "sight"
        ? `It saw you ${zoneWords}${this.lanternLit ? " — the lit lantern made you easier to pick out" : ""}.`
        : cause === "fog churn"
          ? `Fog churn gave you away ${zoneWords}: your noise reached ${this.noiseRadius.toFixed(1)} metres while the fog was thick.`
          : cause === "noise"
            ? `Your noise gave you away ${zoneWords}: ${this.gait === "hustle" ? "hustling" : "walking"} with ${weight} kg made a ${this.noiseRadius.toFixed(1)}-metre ring.`
            : text ?? cause;
    this.lastDetectionText = base;
  }

  private trySecondWind(mon: Monster): boolean {
    if (this.runConfig.perkId !== "second-wind" || this.secondWindUsed) return false;
    const h = heaviestOf(this.carried);
    if (!h) return false;
    this.secondWindUsed = true;
    const away = this.playerPos.clone().sub(mon.group.position).setY(0).normalize();
    this.playerPos.add(away.multiplyScalar(2.4));
    this.playerPos.x = clamp(this.playerPos.x, -64, 64);
    this.playerPos.z = clamp(this.playerPos.z, -106, 110);
    this.graceUntil = this.elapsed + 3;
    mon.ignoreUntil = this.elapsed + 3;
    mon.state = "hunting";
    mon.heard = this.playerPos.clone().sub(away.multiplyScalar(2.4));
    mon.lastSeen = mon.heard;
    this.dropItem(h.uid);
    this.setStatus("Second Wind — you break free and drop your heaviest item. It has lost you, for now.");
    return true;
  }

  /* ═══════════════ the loop ═══════════════ */

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private inputVector(): { x: number; z: number; hustle: boolean } {
    let ix = 0;
    let iz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) iz += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) iz -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ix -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ix += 1;
    ix += this.joy.x;
    iz += this.joy.y;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const hustle = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.hustleToggle;
    return { x: ix, z: iz, hustle };
  }

  private losBlocked(ax: number, az: number, bx: number, bz: number): boolean {
    const ay = terrainHeight(ax, az) + 3.0;
    const by = terrainHeight(bx, bz) + 1.4;
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const x = lerp(ax, bx, t);
      const z = lerp(az, bz, t);
      if (terrainHeight(x, z) > lerp(ay, by, t) + 0.4) return true;
    }
    return false;
  }

  private pushOutOfColliders(p: THREE.Vector3, radius: number) {
    for (const c of this.colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d2 = dx * dx + dz * dz;
      const rr = c.r + radius;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = c.x + (dx / d) * rr;
        p.z = c.z + (dz / d) * rr;
      }
    }
  }

  private step(dt: number) {
    this.fogTime += dt;
    const playing = this.phase === "playing" && !this.paused;
    if (playing) {
      this.elapsed += dt;
      this.timeLeft = Math.max(0, this.runDuration - this.elapsed);
    }
    const progress = this.phase === "idle" ? 0.22 : 1 - this.timeLeft / this.runDuration;

    /* fog: a slow wave rolling in and out, thickening toward nightfall */
    /* phase offset -1.4: a run OPENS on a clear holler; the first fog
       rolls in half a minute later, like the tutorial says it will */
    const wave = Math.pow(0.5 + 0.5 * Math.sin(this.fogTime * ((Math.PI * 2) / 85) - 1.4), 1.6);
    const base = lerp(0.006, 0.0135, progress);
    this.fogDensity = this.fogOverride ?? clamp(base + wave * 0.017, 0.005, 0.036);
    if (playing && this.runConfig.perkId === "fog-sense" && this.fogOverride === null && !this.fogThick) {
      const futureProgress = clamp(progress + 5 / this.runDuration, 0, 1);
      const futureWave = Math.pow(0.5 + 0.5 * Math.sin((this.fogTime + 5) * ((Math.PI * 2) / 85) - 1.4), 1.6);
      const futureDensity = clamp(lerp(0.006, 0.0135, futureProgress) + futureWave * 0.017, 0.005, 0.036);
      const cycle = Math.floor((this.fogTime + 1.4) / 85);
      if (futureDensity >= FOG_THICK && this.fogWarnedCycle !== cycle) {
        this.fogWarnedCycle = cycle;
        this.setStatus("The air turns cold — a fog bank is about five seconds out.");
      }
    }
    if (this.fogThick) this.fogWarnedCycle = Math.floor((this.fogTime + 1.4) / 85);
    this.fog.density = this.fogDensity;
    this.fogThick = this.fogDensity >= FOG_THICK;
    const sky = this.skyDay.clone().lerp(this.skyDusk, progress);
    this.fog.color.copy(sky);
    (this.scene.background as THREE.Color).copy(sky);
    this.sun.color.copy(this.sunDay.clone().lerp(this.sunDusk, progress));
    this.sun.intensity = lerp(2.4, 1.05, progress);
    this.sun.position.set(lerp(-40, -14, progress), lerp(70, 26, progress), -30);
    this.hemi.intensity = lerp(0.55, 0.32, progress);
    this.audio.setWind(this.fogThick ? 1 : wave * 0.5);

    if (this.phase === "idle") this.attractCamera(dt);
    if (playing) this.stepPlaying(dt);
    else if (this.phase === "playing") {
      // paused mid-run: keep the camera honest, freeze the world
      this.updateCamera(dt);
    } else this.idleAnimate(dt);

    this.updateCamera(dt);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.15;
      this.emitHud();
    }
  }

  private idleAnimate(dt: number) {
    // the scavenger waits at the trailhead, breathing
    const t = this.fogTime;
    this.player.position.copy(this.playerPos);
    this.player.position.y = terrainHeight(this.playerPos.x, this.playerPos.z) + Math.sin(t * 1.4) * 0.015;
    for (const mon of this.monsters) {
      mon.group.position.y = terrainHeight(mon.group.position.x, mon.group.position.z) + Math.sin(t * 0.9 + mon.phase) * 0.03;
      mon.armL.rotation.x = Math.sin(t * 0.7 + mon.phase) * 0.06 + 0.12;
      mon.armR.rotation.x = Math.cos(t * 0.6 + mon.phase) * 0.06 + 0.12;
    }
    this.ring.visible = false;
    this.ringFill.visible = false;
    void dt;
  }

  private attractCamera(dt: number) {
    const t = this.fogTime * 0.07;
    const cx = pathX(-74) + 6;
    const cz = -74;
    const px = cx + Math.sin(t) * 15;
    const pz = cz + Math.cos(t) * 15;
    const py = terrainHeight(px, pz) + 5.2;
    this.camPos.lerp(new THREE.Vector3(px, py, pz), 1 - Math.pow(0.001, dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(cx, terrainHeight(cx, cz) + 1.6, cz);
  }

  private stepPlaying(dt: number) {
    const input = this.inputVector();
    this.gait = input.hustle ? "hustle" : "walk";
    const weight = this.carried.reduce((s, i) => s + i.weightKg, 0);
    const weightFactor = 1 - 0.42 * (weight / TOTAL_WEIGHT);
    let speed = (input.hustle ? 6.4 : 3.6) * weightFactor;
    const newZone = this.zoneAt(this.playerPos.x, this.playerPos.z);
    if (newZone !== this.zone) {
      this.zone = newZone;
      this.setStatus(ZONE_LINES[newZone]);
    }
    const zoneFog = this.zoneFogFactor(this.zone);
    if (this.fogThick) speed *= 1 - 0.22 * clamp(zoneFog, 0, 1.3);
    if (this.zone === "creek") {
      speed *= 1.15;
      if (this.routeEvent === "flooded-creek") speed *= 0.88;
    }
    if (this.routeEvent === "washed-road" && Math.abs(this.playerPos.x - pathX(this.playerPos.z)) < 2.7) speed *= 0.82;
    const moving = Math.hypot(input.x, input.z) > 0.12;

    const F = { x: Math.sin(this.camYaw), z: Math.cos(this.camYaw) };
    const R = { x: -Math.cos(this.camYaw), z: Math.sin(this.camYaw) };
    const mx = F.x * input.z + R.x * input.x;
    const mz = F.z * input.z + R.z * input.x;
    const ml = Math.hypot(mx, mz) || 1;

    if (moving) {
      const nx = this.playerPos.x + (mx / ml) * speed * dt * Math.min(1, Math.hypot(input.x, input.z) + 0.35);
      const nz = this.playerPos.z + (mz / ml) * speed * dt * Math.min(1, Math.hypot(input.x, input.z) + 0.35);
      // steep ground turns you aside — ridges are walls you slide along
      if (terrainSlope(nx, nz) <= 1.35) {
        this.playerPos.x = nx;
        this.playerPos.z = nz;
      } else if (terrainSlope(nx, this.playerPos.z) <= 1.35) {
        this.playerPos.x = nx;
      } else if (terrainSlope(this.playerPos.x, nz) <= 1.35) {
        this.playerPos.z = nz;
      }
      this.playerPos.x = clamp(this.playerPos.x, -64, 64);
      this.playerPos.z = clamp(this.playerPos.z, -106, 110);
      this.pushOutOfColliders(this.playerPos, 0.45);
      const targetFacing = Math.atan2(mx, mz);
      let diff = targetFacing - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 10);
      this.walkPhase += dt * speed * 2.1;
    }
    const groundY = terrainHeight(this.playerPos.x, this.playerPos.z);
    this.playerPos.y = lerp(this.playerPos.y || groundY, groundY, Math.min(1, dt * 14));
    this.player.position.copy(this.playerPos);
    this.player.position.y += moving ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : Math.sin(this.fogTime * 1.4) * 0.015;
    this.player.rotation.y = this.facing;
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;

    /* noise — speed uses real weight; the ring uses noise weight, so the
       quilt and Pack Mule can make a load quieter without making it lighter */
    let noise = 0;
    if (moving) {
      const nw = this.noiseWeight();
      noise = input.hustle ? 11 + nw * 0.35 : 5 + nw * 0.22;
      if (this.zone === "creek") noise *= this.routeEvent === "flooded-creek" ? 1.8 : 1.4;
      if (this.zone === "rail") noise *= 0.8;
      if (this.fogThick) noise *= 1 + 0.5 * zoneFog;
      if (this.runConfig.perkId === "soft-step") noise *= 0.9;
    }
    if (noise > this.noiseRadius) {
      const rate = this.runConfig.perkId === "iron-lungs" && input.hustle ? 4.5 : 8;
      this.noiseRadius += (noise - this.noiseRadius) * Math.min(1, dt * rate);
      if (noise - this.noiseRadius < 0.03) this.noiseRadius = noise;
    } else {
      this.noiseRadius = noise;
    }
    noise = this.noiseRadius;
    if (noise > this.peakNoise) {
      this.peakNoise = noise;
      const zoneWords = { hollow: "in the hollow", ridge: "on the ridge", creek: "splashing through the creek", homestead: "by the homestead", rail: "on the rail bed" }[this.zone];
      this.loudestMoment = `${input.hustle ? "Hustling" : "Walking"} ${zoneWords}${this.fogThick ? " in thick fog" : ""} with ${weight} kg — a ${noise.toFixed(1)}-metre ring of noise.`;
    }
    /* the drawn ring IS the noise radius — one value, no display fudge:
       silent (radius 0) draws no ring at all, and the pack panel says so */
    this.ring.visible = noise > 0;
    this.ringFill.visible = noise > 0;
    this.ring.scale.setScalar(noise);
    this.ringFill.scale.setScalar(noise);
    this.ring.position.set(this.playerPos.x, this.playerPos.y + 0.18, this.playerPos.z);
    this.ringFill.position.copy(this.ring.position);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = moving ? 0.5 + 0.18 * Math.sin(this.fogTime * 5) : 0.25;

    /* dropped loot: walk over it to take it back */
    for (let i = this.dropped.length - 1; i >= 0; i--) {
      const d = this.dropped[i];
      d.mesh.rotation.y += dt * 0.8;
      d.mesh.position.y = terrainHeight(d.mesh.position.x, d.mesh.position.z) + 0.3 + Math.sin(this.fogTime * 2 + i) * 0.05;
      const dist = Math.hypot(d.mesh.position.x - this.playerPos.x, d.mesh.position.z - this.playerPos.z);
      if (!d.armed && dist > 2.2) d.armed = true;
      if (d.armed && dist < 1.3) {
        this.carried.push(d.item);
        this.scene.remove(d.mesh);
        this.dropped.splice(i, 1);
        this.audio.tick();
        this.setStatus(`Picked the ${d.item.name.toLowerCase()} back up.`);
        this.updatePackVisual();
        this.emitHud();
      }
    }

    this.stepMonsters(dt, noise);
    this.stepHallucinations(dt);

    /* endings */
    const gapC = pathX(104);
    if (this.playerPos.z > EXIT_Z && Math.abs(this.playerPos.x - gapC) < 7.5) {
      this.endRun("escaped", "County Road");
      return;
    }
    if (this.playerPos.z > 100 && Math.abs(this.playerPos.x - railX(this.playerPos.z)) < 6.5) {
      this.endRun("escaped", "Rail Tunnel");
      return;
    }
    for (const mon of this.monsters) {
      const d = Math.hypot(mon.group.position.x - this.playerPos.x, mon.group.position.z - this.playerPos.z);
      if (d < 1.5 && this.elapsed >= this.graceUntil) {
        if (!this.trySecondWind(mon)) {
          this.endRun("caught");
          return;
        }
      }
    }
    if (this.timeLeft <= 0) {
      this.endRun("nightfall");
      return;
    }
    this.updateCaptionVoices();
  }

  private stepMonsters(dt: number, noise: number) {
    const late = this.timeLeft < 60;
    const diff = this.runConfig.difficulty === "story" ? { speed: 0.85, sight: 0.85 } : this.runConfig.difficulty === "ruthless" ? { speed: 1.15, sight: 1 } : { speed: 1, sight: 1 };
    if (this.activeDecoy && this.elapsed > this.activeDecoy.until) this.activeDecoy = null;

    for (const mon of this.monsters) {
      const mp = mon.group.position;
      const toPlayer = Math.hypot(this.playerPos.x - mp.x, this.playerPos.z - mp.z);
      const temp = {
        patient: { hearing: 1, sight: 1, gain: 0.72, decay: 0.05, speed: 0.92, memory: 6 },
        bold: { hearing: 1, sight: 1, gain: 1.25, decay: 0.16, speed: 1.12, memory: 2.6 },
        deaf: { hearing: 0.7, sight: 1.15, gain: 1, decay: 0.1, speed: 1, memory: 4 },
      }[mon.temperament];
      let sightRange = (this.fogThick ? 11 : 26) * (late ? 1.15 : 1) * diff.sight * temp.sight;
      if (this.lanternLit) sightRange *= 1.35;
      const canSee =
        this.elapsed >= mon.ignoreUntil &&
        toPlayer < sightRange &&
        !this.losBlocked(mp.x, mp.z, this.playerPos.x, this.playerPos.z);

      const decoy = this.activeDecoy;
      const decoyDist = decoy ? Math.hypot(decoy.pos.x - mp.x, decoy.pos.z - mp.z) : Infinity;
      const fiddle = this.dropped.find((d) => d.lureUntil !== undefined && d.lureUntil > this.elapsed);
      const fiddleDist = fiddle ? Math.hypot(fiddle.mesh.position.x - mp.x, fiddle.mesh.position.z - mp.z) : Infinity;

      if (decoy && decoyDist < decoy.radius && toPlayer > 8) {
        if (mon.state !== "hunting") mon.lastDetectionCause = "coin burst";
        mon.state = "hunting";
        mon.heard = decoy.pos.clone();
        mon.awareness = Math.max(mon.awareness, 0.8);
      } else if (fiddle && fiddleDist < 48 && !(canSee && toPlayer < 12)) {
        if (mon.state !== "hunting") mon.lastDetectionCause = "fiddle";
        mon.state = "hunting";
        mon.heard = fiddle.mesh.position.clone();
        mon.awareness = Math.max(mon.awareness, 0.75);
      } else if (canSee) {
        if (mon.state !== "chasing") {
          mon.lastDetectionCause = "sight";
          this.recordDetection("sight");
          this.setStatus("It has seen you — RUN.");
        }
        mon.state = "chasing";
        mon.awareness = 1;
        mon.lastSeen = this.playerPos.clone();
        mon.loseTimer = 4;
        mon.wasChasing = true;
      } else if (mon.state === "chasing") {
        mon.loseTimer -= dt;
        if (mon.loseTimer <= 0) {
          mon.state = "hunting";
          mon.heard = mon.lastSeen;
          mon.searchTimer = temp.memory;
          mon.wasChasing = false;
        }
      } else {
        const hearingRadius = noise * temp.hearing;
        if (noise > 0.5 && toPlayer <= hearingRadius) {
          const closeness = clamp(1 - toPlayer / Math.max(1, hearingRadius), 0.15, 1);
          mon.awareness = clamp(mon.awareness + dt * 1.35 * closeness * temp.gain, 0, 1);
          const baseNoise = noise / (this.fogThick ? 1 + 0.5 * this.zoneFogFactor(this.zone) : 1) / (this.runConfig.perkId === "soft-step" ? 0.9 : 1);
          const fogMadeTheDifference = this.fogThick && toPlayer > baseNoise && toPlayer <= noise;
          if (mon.awareness >= 0.62 && mon.state !== "hunting") {
            mon.state = "hunting";
            mon.lastDetectionCause = fogMadeTheDifference ? "fog churn" : "noise";
            this.recordDetection(mon.lastDetectionCause);
          } else if (mon.awareness >= 0.22 && mon.state === "unaware") {
            mon.state = "curious";
            mon.lastDetectionCause = fogMadeTheDifference ? "fog churn" : "noise";
            this.recordDetection(mon.lastDetectionCause);
          }
          if (mon.state === "curious" || mon.state === "hunting") mon.heard = this.playerPos.clone();
        } else {
          mon.awareness = clamp(mon.awareness - dt * temp.decay, 0, 1);
          if (mon.state === "hunting") {
            mon.searchTimer -= dt;
            if (mon.searchTimer <= 0) {
              mon.state = "curious";
              mon.searchTimer = 3;
              mon.waypoint = this.roamPointNear(mon.heard ?? mp);
            }
          } else if (mon.state === "curious") {
            mon.searchTimer -= dt;
            if (mon.searchTimer <= 0 && mon.awareness < 0.35) {
              mon.state = "unaware";
              mon.heard = null;
              mon.waypoint = this.roamPoint();
            }
          }
        }
      }

      let speed = 0;
      let target: THREE.Vector3 | null = null;
      if (mon.state === "chasing") {
        target = this.playerPos;
        speed = 5.7;
      } else if (mon.state === "hunting" && mon.heard) {
        target = mon.heard;
        speed = 4.05;
        if (Math.hypot(mon.heard.x - mp.x, mon.heard.z - mp.z) < 1.6) {
          speed = 0;
          mon.group.rotation.y += dt * 0.7;
        }
      } else if (mon.state === "curious") {
        target = mon.heard ?? mon.waypoint;
        speed = 2.75;
        if (target && Math.hypot(target.x - mp.x, target.z - mp.z) < 1.6) speed = 0;
      } else {
        mon.state = "unaware";
        target = mon.waypoint;
        speed = 2.3 * (late ? 1.15 : 1);
        if (Math.hypot(mon.waypoint.x - mp.x, mon.waypoint.z - mp.z) < 2.2) mon.waypoint = this.roamPoint();
      }
      speed *= diff.speed * temp.speed;

      if (target && speed > 0) {
        const dx = target.x - mp.x;
        const dz = target.z - mp.z;
        const dl = Math.hypot(dx, dz) || 1;
        const nx = mp.x + (dx / dl) * speed * dt;
        const nz = mp.z + (dz / dl) * speed * dt;
        if (terrainSlope(nx, nz) <= 1.4) {
          mp.x = nx;
          mp.z = nz;
        } else if (terrainSlope(nx, mp.z) <= 1.4) {
          mp.x = nx;
        } else if (terrainSlope(mp.x, nz) <= 1.4) {
          mp.z = nz;
        }
        const want = Math.atan2(dx, dz);
        let diffAngle = want - mon.group.rotation.y;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        mon.group.rotation.y += diffAngle * Math.min(1, dt * 5);
        mon.phase += dt * speed * 1.15;
      }
      for (const other of this.monsters) {
        if (other === mon) continue;
        const dx = mp.x - other.group.position.x;
        const dz = mp.z - other.group.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 4 && d2 > 0.001) {
          const d = Math.sqrt(d2);
          mp.x += (dx / d) * (2 - d) * 0.5 * dt * 4;
          mp.z += (dz / d) * (2 - d) * 0.5 * dt * 4;
        }
      }
      this.pushOutOfColliders(mp, 0.5);
      mp.y = terrainHeight(mp.x, mp.z) + (speed > 0 ? Math.abs(Math.sin(mon.phase)) * 0.06 : Math.sin(this.fogTime * 0.9 + mon.phase) * 0.03);
      const sw = Math.sin(mon.phase) * 0.4;
      mon.legL.rotation.x = sw;
      mon.legR.rotation.x = -sw;
      mon.armL.rotation.x = -sw * 0.4 + 0.12;
      mon.armR.rotation.x = sw * 0.4 + 0.12;
    }
  }

  private roamPointNear(around: THREE.Vector3): THREE.Vector3 {
    const z = clamp(around.z + (this.rng() * 2 - 1) * 14, -95, 90);
    const x = clamp(around.x + (this.rng() * 2 - 1) * 14, -40, 40);
    return new THREE.Vector3(x, 0, z);
  }

  private roamPoint(): THREE.Vector3 {
    const z = -95 + this.rng() * 185;
    const x = clamp(pathX(z) + (this.rng() * 2 - 1) * 17, -40, 40);
    return new THREE.Vector3(x, 0, z);
  }

  private stepHallucinations(dt: number) {
    if (this.lanternLit) return; // a lit lantern suppresses the fog's tricks
    // false growls: the audio radar lies while the fog is thick
    if (this.fogThick) {
      this.falseGrowlTimer -= dt;
      if (this.falseGrowlTimer <= 0) {
        this.falseGrowlTimer = (11 + this.rng() * 8) * (this.runConfig.reducedHallucinations ? 2.5 : 1) / Math.max(0.4, this.zoneFogFactor(this.zone));
        const bearing = this.rng() * Math.PI * 2 - Math.PI;
        const distBucket = 12 + this.rng() * 22;
        this.audio.falseGrowl(Math.sin(bearing), clamp(17 / (distBucket + 3) - 0.1, 0.15, 0.85));
        this.caption = `Something growls — ${distBucket < 18 ? "near" : "far off"} — ${bearingWords(bearing)}${this.runConfig.perkId === "light-sleeper" ? " — …or maybe nothing" : ""}`;
        this.captionBearing = (bearing * 180) / Math.PI;
        this.captionCloseness = clamp(1 - distBucket / 40, 0.15, 0.9);
        this.falseCaptionUntil = this.elapsed + 3.2;
      }
      // phantoms at the edge of vision
      this.phantomTimer -= dt;
      if (this.phantomTimer <= 0) {
        this.phantomTimer = (9 + this.rng() * 6) * (this.runConfig.reducedHallucinations ? 2.5 : 1) / Math.max(0.4, this.zoneFogFactor(this.zone));
        const p = this.runConfig.reducedHallucinations && this.rng() < 0.5 ? undefined : this.phantoms.find((ph) => !ph.active);
        if (p) {
          const ang = this.rng() * Math.PI * 2;
          const dist = 19 + this.rng() * 7;
          const x = clamp(this.playerPos.x + Math.sin(ang) * dist, -58, 58);
          const z = clamp(this.playerPos.z + Math.cos(ang) * dist, -102, 100);
          p.group.position.set(x, terrainHeight(x, z), z);
          p.group.rotation.y = Math.atan2(this.playerPos.x - x, this.playerPos.z - z);
          p.active = true;
          p.life = 5;
          p.lookTime = 0;
          p.group.visible = true;
        }
      }
    }
    for (const p of this.phantoms) {
      if (!p.active) continue;
      p.life -= dt;
      const toP = new THREE.Vector3().subVectors(p.group.position, this.camera.position);
      const dist = Math.hypot(toP.x, toP.z);
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      const dot = (fwd.x * toP.x + fwd.z * toP.z) / (Math.hypot(fwd.x, fwd.z) * (dist || 1));
      if (dot > 0.86) p.lookTime += dt;
      const dissolving = p.lookTime > 0.55 || dist < 9;
      const target = dissolving || p.life <= 0 ? 0 : 0.5;
      for (const m of p.mats) m.opacity = lerp(m.opacity, target, Math.min(1, dt * 5));
      if ((dissolving && p.mats[0].opacity < 0.04) || p.life <= -1) {
        p.active = false;
        p.group.visible = false;
      }
    }
  }

  private updateCaptionVoices() {
    // place the real growls; compute the caption from the nearest real monster
    const camF = new THREE.Vector3();
    this.camera.getWorldDirection(camF);
    let nearest: { d: number; bearing: number; state: MonsterState } | null = null;
    this.monsters.forEach((mon, i) => {
      const mp = mon.group.position;
      const dx = mp.x - this.camera.position.x;
      const dz = mp.z - this.camera.position.z;
      const d = Math.hypot(dx, dz);
      const bearing = signedAngle(camF.x, camF.z, dx, dz);
      const level = clamp(17 / (d + 3) - 0.1, 0, 1);
      this.audio.setVoice(mon.voice >= 0 ? mon.voice : i, d > 95 ? 0 : level, Math.sin(bearing), mon.state);
      if (!nearest || d < nearest.d) nearest = { d, bearing, state: mon.state };
    });
    this.captionTimer -= 0.016;
    if (nearest && this.elapsed >= this.falseCaptionUntil) {
      const n = nearest as { d: number; bearing: number; state: MonsterState };
      this.soundLevel = clamp(17 / (n.d + 3) - 0.1, 0, 1);
      this.soundBearing = (n.bearing * 180) / Math.PI;
      this.nearestMonsterState = n.state;
      if (n.d < 46) {
        const stateWords = {
          unaware: "breathing slow, unaware",
          curious: "growls, uncertain — it heard something",
          hunting: "is hunting — moving with purpose",
          chasing: "— and coming fast",
        }[n.state];
        this.caption = n.state === "unaware"
          ? `Something breathes — ${n.d < 20 ? "near" : "off in the trees"} — ${bearingWords(n.bearing)} — ${stateWords}`
          : `Something ${stateWords} — ${n.d < 10 ? "close" : n.d < 20 ? "near" : n.d < 34 ? "off in the trees" : "far off"} — ${bearingWords(n.bearing)}`;
        this.captionBearing = (n.bearing * 180) / Math.PI;
        this.captionCloseness = clamp(1 - n.d / 46, 0, 1);
      } else {
        this.caption = "";
        this.captionBearing = null;
        this.captionCloseness = 0;
        this.soundLevel = 0;
      }
    }
  }

  private updateCamera(dt: number) {
    if (this.phase === "idle") return;
    const F = { x: Math.sin(this.camYaw), z: Math.cos(this.camYaw) };
    const dist = 8;
    const tx = this.playerPos.x - F.x * dist;
    const tz = this.playerPos.z - F.z * dist;
    const ty = Math.max(
      terrainHeight(tx, tz) + 0.7,
      this.playerPos.y + 1.4 + Math.sin(this.camPitch) * dist * 0.62
    );
    const target = new THREE.Vector3(tx, ty, tz);
    this.camPos.lerp(target, 1 - Math.pow(0.0001, dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.7, this.playerPos.z);
  }

  private endRun(kind: OutcomeKind, exitUsed: string | null = null) {
    if (this.phase !== "playing") return;
    this.phase = "ended";
    const carriedList: LeftItem[] = this.carried.map((i) => ({ name: i.name, value: i.value, weightKg: i.weightKg }));
    const left: LeftItem[] = this.dropped.map((d) => ({ name: d.item.name, value: d.item.value, weightKg: d.item.weightKg }));
    const value = kind === "escaped" ? this.carried.reduce((s, i) => s + i.value, 0) : 0;
    this.outcome = {
      kind,
      value,
      carried: carriedList,
      leftBehind: kind === "escaped" ? left : [...left, ...carriedList],
      secondsUsed: Math.floor(this.elapsed),
      exitUsed,
      gaveAway: kind === "caught" ? this.lastDetectionText ?? this.loudestMoment : null,
      loudestMoment: this.loudestMoment,
      peakNoise: +this.peakNoise.toFixed(1),
      routeEvent: this.routeEvent,
      seed: this.runConfig.seed,
    };
    if (kind === "escaped") this.audio.escapeChime();
    else this.audio.sting();
    this.ring.visible = false;
    this.ringFill.visible = false;
    this.emitHud();
  }

  private emitHud() {
    const h = heaviestOf(this.carried);
    this.onHud({
      phase: this.phase,
      timeLeft: this.timeLeft,
      totalTime: this.runDuration,
      carried: this.carried.map((i) => ({ uid: i.uid, id: i.id, name: i.name, value: i.value, weightKg: i.weightKg, quirk: i.quirk, wrapped: this.wrappedUids.has(i.uid), origin: this.lootLayout[i.id] ?? "the homestead" })),
      carriedValue: this.carried.reduce((s, i) => s + i.value, 0),
      carriedWeight: this.carried.reduce((s, i) => s + i.weightKg, 0),
      heaviestName: h?.name ?? null,
      heaviestWeight: h?.weightKg ?? 0,
      gait: this.gait,
      noiseRadius: this.noiseRadius,
      fogThick: this.fogThick,
      caption: this.caption,
      captionBearingDeg: this.captionBearing,
      captionCloseness: this.captionCloseness,
      statusLine: this.statusLine,
      statusAt: this.statusAt,
      outcome: this.outcome,
      zone: this.zone,
      zoneLine: ZONE_LINES[this.zone],
      seed: this.runConfig.seed,
      difficulty: this.runConfig.difficulty,
      perkId: this.runConfig.perkId,
      routeEvent: this.runConfig.perkId === "trailwise" ? this.routeEvent : null,
      routeEventLine: this.runConfig.perkId === "trailwise" ? ROUTE_EVENT_LINES[this.routeEvent] : null,
      shortcutCleared: this.shortcutCleared,
      fallenTreeActive: this.routeEvent === "fallen-tree" && !this.shortcutCleared,
      nearFallenTree: this.isNearFallenTree(),
      lanternLit: this.lanternLit,
      monsterState: this.nearestMonsterState,
      soundLevel: this.soundLevel,
      soundBearingDeg: this.soundBearing,
    });
  }
}

/* bearing helpers shared by captions + audio */
export function signedAngle(fx: number, fz: number, dx: number, dz: number): number {
  const af = Math.atan2(fx, fz);
  const ad = Math.atan2(dx, dz);
  let d = ad - af;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function bearingWords(bearingRad: number): string {
  const deg = (bearingRad * 180) / Math.PI;
  const a = Math.abs(deg);
  if (a < 22) return "ahead of you";
  if (a < 67) return deg > 0 ? "ahead, to your right" : "ahead, to your left";
  if (a < 112) return deg > 0 ? "to your right" : "to your left";
  if (a < 157) return deg > 0 ? "behind you, right" : "behind you, left";
  return "behind you";
}
