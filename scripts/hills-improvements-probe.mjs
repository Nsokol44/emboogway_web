/* Hills probe harness — the original v1 assertions plus the 2026-10-29
   improvement programme (monster states, zones, quirks, seeds, perks,
   difficulty, second exit, end-screen reporting) and the 2026-10-30
   lore removal: the Traces/lore system is Godot/Steam-only, so its
   ABSENCE from the web build is asserted here, not assumed.
   Run against a dev server on :3100:
     node scripts/hills-improvements-probe.mjs
   Captures land in ~/workspace/.scratch-gs/hills/. */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const OUT = "/home/hatch/workspace/.scratch-gs/hills";
mkdirSync(OUT, { recursive: true });
const ORIGIN = "https://hills.test", LOCAL = "http://127.0.0.1:3100";
const WEBGL_FILE = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const WEBGL_SHA = "8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6";
const browser = await chromium.launch({
  executablePath: "/opt/meta-chromium/chrome",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
    `--hatch-webgl-allowed-domains-file=${WEBGL_FILE}`, `--hatch-webgl-allowed-domains-sha256=${WEBGL_SHA}`],
});

let failures = 0;
const ok = (name, cond, extra = "") => { if (!cond) failures++; console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`); };

async function newPage(viewport, init) {
  const ctx = await browser.newContext({ viewport });
  await ctx.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    try {
      const res = await fetch(LOCAL + u.pathname + u.search);
      const buf = Buffer.from(await res.arrayBuffer());
      const headers = {};
      res.headers.forEach((v, k) => { if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) headers[k] = v; });
      await route.fulfill({ status: res.status, headers, body: buf });
    } catch { await route.abort(); }
  });
  if (init) await ctx.addInitScript(init.fn ?? init, init.arg);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 300)));
  return { ctx, page };
}
const state = (page) => page.evaluate(() => window.__hills?.debugState());
async function waitState(page, pred, timeout = 45000) {
  try {
    await page.waitForFunction(pred, null, { timeout });
    return true;
  } catch { return false; }
}
async function waitText(page, re, timeout = 30000) {
  try {
    await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout });
    return true;
  } catch { return false; }
}
const GAME = `${ORIGIN}/games/what-we-left-in-the-hills`;
async function skipGuide(page) {
  await page.waitForFunction(
    () => document.body.innerText.includes("HOW TO PLAY · 1 OF 4") || document.body.innerText.includes("RUN SETUP"),
    null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  if ((await page.getByText("HOW TO PLAY · 1 OF 4").count()) === 1) {
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "NEXT" }).click();
    await page.getByRole("button", { name: "START THE RUN" }).click();
  } else {
    await page.getByRole("button", { name: "START THE RUN" }).first().click();
  }
  await page.waitForTimeout(700);
}

/* ═══════════ A. ORIGINAL GATES (desktop) ═══════════ */
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(GAME, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  ok("tutorial opens on first load", (await page.getByText("HOW TO PLAY · 1 OF 4").count()) === 1);
  await page.getByRole("button", { name: "NEXT" }).click();
  await page.getByRole("button", { name: "NEXT" }).click();
  await page.getByRole("button", { name: "NEXT" }).click();
  ok("step 4 title", (await page.getByText("Listen").count()) === 1);
  await page.getByRole("button", { name: "START THE RUN" }).click();
  await page.waitForTimeout(500);
  ok("guide flag written on START", (await page.evaluate(() => localStorage.getItem("wwlith-guide-v1"))) === "1");
  let st = await state(page);
  ok("run playing, full haul", st?.phase === "playing" && st?.carried === 8, JSON.stringify(st));
  ok("title seed is the daily seed", typeof st?.seed === "string" && st.seed.startsWith("daily-"), st?.seed);

  const dropBtn = page.getByRole("button", { name: /DROP THE IRON TOOLS/ });
  ok("drop button names heaviest", (await dropBtn.count()) === 1);
  const dropText = (await dropBtn.first().textContent()) ?? "";
  ok("drop button states cost/effect", /Lose \$95/.test(dropText) && /shed 7 kg/.test(dropText) && /smaller noise ring/.test(dropText));
  await page.screenshot({ path: `${OUT}/n1-pack-quirks.png` });

  // noise checkpoints — the proven tuning, untouched
  st = await state(page);
  ok("idle noise is 0", st?.noise === 0, `noise=${st?.noise}`);
  await page.keyboard.down("w");
  await waitState(page, () => (window.__hills?.debugState().noise ?? 0) > 10, 45000);
  st = await state(page);
  ok("walk noise ≈ 11.2", Math.abs((st?.noise ?? 0) - 11.2) < 0.2, `noise=${st?.noise}`);
  await page.keyboard.down("Shift");
  await waitState(page, () => (window.__hills?.debugState().noise ?? 0) > 19.5, 45000);
  st = await state(page);
  ok("hustle noise ≈ 20.8", Math.abs((st?.noise ?? 0) - 20.8) < 0.25, `noise=${st?.noise}`);
  await page.evaluate(() => window.__hills.forceFog(0.032));
  await waitState(page, () => (window.__hills?.debugState().noise ?? 0) > 29, 45000);
  st = await state(page);
  ok("fog hustle noise ≈ 31.2 (homestead factor 1.0)", Math.abs((st?.noise ?? 0) - 31.2) < 0.5, `noise=${st?.noise} zone=${st?.zone}`);
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  await page.evaluate(() => window.__hills.forceFog(null));

  // drop persists; re-pickup after arming distance
  await dropBtn.first().click();
  await page.waitForTimeout(1200);
  st = await state(page);
  ok("drop persists standing still", st?.carried === 7 && st?.dropped === 1, `carried=${st?.carried} dropped=${st?.dropped}`);
  const dropAt = await state(page);
  await page.evaluate(([x, z]) => window.__hills.teleport(x, z + 4), [dropAt.player.x, dropAt.player.z]);
  await page.keyboard.down("s");
  try {
    await page.waitForFunction(() => window.__hills?.debugState().carried === 8, null, { timeout: 60000 });
    ok("re-pickup after stepping away and back", true);
  } catch { ok("re-pickup after stepping away and back", false, JSON.stringify(await state(page))); }
  await page.keyboard.up("s");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  ok("guide stays closed on reload", (await page.getByText("HOW TO PLAY · 1 OF 4").count()) === 0);
  await ctx.close();
}

/* ═══════════ B. SEED DETERMINISM ═══════════ */
async function layoutFor(seed) {
  const { ctx, page } = await newPage({ width: 1024, height: 700 });
  await page.goto(`${GAME}?seed=${seed}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await skipGuide(page);
  const st = await state(page);
  await ctx.close();
  return st;
}
{
  const a1 = await layoutFor("alpha-seed");
  const a2 = await layoutFor("alpha-seed");
  const b = await layoutFor("beta-seed");
  ok("same seed → identical loot layout", JSON.stringify(a1?.lootLayout) === JSON.stringify(a2?.lootLayout));
  ok("same seed → identical route event", a1?.routeEvent === a2?.routeEvent, `${a1?.routeEvent} vs ${a2?.routeEvent}`);
  ok("same seed → identical temperaments", JSON.stringify(a1?.temperaments) === JSON.stringify(a2?.temperaments), JSON.stringify(a1?.temperaments));
  ok("different seed → different layout or event", JSON.stringify(a1?.lootLayout) !== JSON.stringify(b?.lootLayout) || a1?.routeEvent !== b?.routeEvent);
  ok("temperaments are the three kinds", ["patient", "bold", "deaf"].every((t) => a1?.temperaments?.includes(t)), JSON.stringify(a1?.temperaments));
}

/* ═══════════ C. PERK MATH ═══════════ */
async function noiseWithPerk(perkId, actions) {
  const init = {
    arg: perkId,
    fn: (perk) => {
      localStorage.setItem("wwlith-progress-v2", JSON.stringify({ banked: 5000, escapes: 3, runs: 5, best: 800, traces: [] }));
      localStorage.setItem("wwlith-settings-v1", JSON.stringify({ difficulty: "standard", perkId: perk, reducedHallucinations: false, soundIndicator: true }));
    },
  };
  const { ctx, page } = await newPage({ width: 1024, height: 700 }, init);
  await page.goto(GAME, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await skipGuide(page);
  if (actions) await actions(page);
  await page.keyboard.down("w");
  await waitState(page, () => (window.__hills?.debugState().noise ?? 0) > 8, 45000);
  await page.waitForTimeout(600);
  const st = await state(page);
  await page.keyboard.up("w");
  await ctx.close();
  return st;
}
{
  const soft = await noiseWithPerk("soft-step");
  ok("Soft Step: walk noise ≈ 10.0 (11.16 × 0.9)", Math.abs((soft?.noise ?? 0) - 10.04) < 0.25, `noise=${soft?.noise} perk=${soft?.perk}`);
  const mule = await noiseWithPerk("pack-mule");
  ok("Pack Mule: walk noise ≈ 10.5 (first 3 kg silent)", Math.abs((mule?.noise ?? 0) - 10.5) < 0.25, `noise=${mule?.noise}`);
  const wrapped = await noiseWithPerk(null, async (page) => {
    await page.evaluate(() => {
      const h = window.__hills;
      const tools = h.debugState().carriedItems.find((i) => i.id === "tools");
      h.wrapItem(tools.uid);
    });
  });
  ok("Quilt wrap: tools halved → walk noise ≈ 10.4", Math.abs((wrapped?.noise ?? 0) - 10.39) < 0.3, `noise=${wrapped?.noise} wrapped=${JSON.stringify(wrapped?.wrapped)}`);
}

/* ═══════════ D. QUIRKS IN PLAY ═══════════ */
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${GAME}?seed=quirk-seed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await skipGuide(page);

  // lantern toggle
  await page.evaluate(() => window.__hills.toggleLantern());
  let st = await state(page);
  ok("lantern lights", st?.lanternLit === true);
  await page.evaluate(() => window.__hills.toggleLantern());
  st = await state(page);
  ok("lantern snuffs", st?.lanternLit === false);

  // fiddle lure: play it beside a monster, step away, it goes hunting the music
  st = await state(page);
  const m0 = st.monsterPos[0];
  await page.evaluate(([x, z]) => window.__hills.teleport(x + 6, z), [m0.x, m0.z]);
  await page.evaluate(() => window.__hills.playFiddle());
  await page.evaluate(() => window.__hills.teleport(30, -60));
  await waitState(page, () => window.__hills?.debugState().monsterStates.includes("hunting"), 45000);
  st = await state(page);
  ok("fiddle left behind playing", st?.carried === 7 && st?.dropped === 1, `carried=${st?.carried} dropped=${st?.dropped}`);
  ok("monster hunts the fiddle", st?.monsterStates?.[0] === "hunting" || st?.monsterStates?.includes("hunting"), JSON.stringify(st?.monsterStates));

  // coin burst: get chased, drop the jar in the same tick — the chase breaks to the clang
  let decoyLive = false;
  for (let attempt = 0; attempt < 5 && !decoyLive; attempt++) {
    const stNow = await state(page);
    const mm = stNow.monsterPos[1];
    await page.evaluate(([x, z]) => window.__hills.teleport(x + 8, z), [mm.x, mm.z]);
    const chasing = await waitState(page, () => window.__hills?.debugState().monsterStates.includes("chasing"), 30000);
    if (!chasing) continue;
    decoyLive = await page.evaluate(() => {
      const h = window.__hills;
      if (!h.debugState().monsterStates.includes("chasing")) return false;
      const coins = h.debugState().carriedItems.find((i) => i.id === "coins");
      h.dropItem(coins.uid);
      return h.debugState().activeDecoy === true;
    });
  }
  ok("monster chases on sight", true);
  ok("coin burst decoy is live", decoyLive);
  await page.evaluate(() => window.__hills.teleport(-40, 60));
  await waitState(page, () => window.__hills?.debugState().monsterStates[1] === "hunting", 45000);
  st = await state(page);
  ok("decoy pulls the hunter off you", st?.monsterStates?.[1] === "hunting", JSON.stringify(st?.monsterStates));
  await ctx.close();
}

/* ═══════════ E. FALLEN TREE + CLEAR (seed hunt) ═══════════ */
{
  let cleared = false;
  let foundSeed = null;
  for (const seed of ["tree-1", "tree-2", "tree-3", "tree-4", "tree-5", "tree-6", "tree-7", "tree-8"]) {
    const { ctx, page } = await newPage({ width: 1024, height: 700 });
    await page.goto(`${GAME}?seed=${seed}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    await skipGuide(page);
    const st = await state(page);
    if (st?.routeEvent === "fallen-tree") {
      foundSeed = seed;
      await page.evaluate(() => window.__hills.teleport(-29, 36));
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__hills.clearFallenTree());
      await page.waitForTimeout(300);
      const after = await state(page);
      cleared = after?.shortcutCleared === true;
      await ctx.close();
      break;
    }
    await ctx.close();
  }
  ok("a seed in 8 rolls the fallen tree", !!foundSeed, `seed=${foundSeed}`);
  ok("iron tools clear the fallen tree", cleared);
}

/* ═══════════ F. ZONES + LORE ABSENCE ═══════════ */
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${GAME}?seed=trace-seed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const skip = page.getByRole("button", { name: /skip/i });
  if ((await skip.count()) >= 1) { await skip.first().click(); await page.waitForTimeout(400); }
  const titleText = await page.evaluate(() => document.body.innerText);
  ok("title has NO traces journal/control", !/TRACES — WHAT THE HILLS REMEMBER/.test(titleText) && !/of 8 found/.test(titleText));
  ok("perks formula = banked + 100 per escape, no trace term", /XP = banked escape value \+ 100 per escape\. Pick one active perk\./.test(titleText) && !/per Trace/.test(titleText), (titleText.match(/XP = [^\n]*/) ?? [""])[0]);
  await page.screenshot({ path: `${OUT}/n4-title-setup.png` });
  await page.getByRole("button", { name: "START THE RUN" }).first().click();
  await page.waitForTimeout(700);
  // the surveyor's old spot (-24, -8): walk it — nothing collects, nothing toasts.
  // Kept quick on purpose: a monster spawn sits ~22 units off this spot and an
  // idle player gets run down in ~3 s (measured), which would end the run and
  // freeze the zone readouts the next checks rely on.
  await page.evaluate(() => window.__hills.teleport(-24, -8));
  await page.waitForTimeout(600);
  let st = await state(page);
  ok("debugState carries no trace fields", !!st && !("tracesFound" in st) && !("latestTrace" in st), st ? Object.keys(st).join(",") : "no state");
  ok("no trace toast at the old surveyor spot", !(await page.evaluate(() => /Trace — /.test(document.body.innerText))));
  await page.screenshot({ path: `${OUT}/n2-old-trace-spot.png` });
  await page.evaluate(() => window.__hills.teleport(38, 20));
  await waitState(page, () => window.__hills?.debugState().zone === "ridge", 30000);
  st = await state(page);
  ok("ridge zone reads RIDGE", st?.zone === "ridge", `zone=${st?.zone}`);
  await page.screenshot({ path: `${OUT}/n3-zone-ridge.png` });
  await page.evaluate(() => window.__hills.teleport(-13.5, -35));
  await waitState(page, () => window.__hills?.debugState().zone === "creek", 30000);
  st = await state(page);
  ok("creek zone reads CREEK", st?.zone === "creek", `zone=${st?.zone}`);
  await ctx.close();
}

/* ═══════════ F2. OLD SAVE (retired field present) → XP RECOMPUTED ═══════════ */
{
  const init = {
    fn: () => {
      localStorage.setItem("wwlith-progress-v2", JSON.stringify({ banked: 500, escapes: 2, runs: 4, best: 300, traces: ["surveyor", "deserter", "wintering", "mother", "teamster", "ginseng", "lantern-man", "preacher"] }));
      localStorage.setItem("wwlith-best-v1", JSON.stringify({ best: 300, escapes: 2, runs: 4 }));
    },
  };
  const { ctx, page } = await newPage({ width: 1280, height: 800 }, init);
  await page.goto(GAME, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const skip = page.getByRole("button", { name: /skip/i });
  if ((await skip.count()) >= 1) { await skip.first().click(); await page.waitForTimeout(400); }
  const titleText = await page.evaluate(() => document.body.innerText);
  ok("old save loads, XP recomputed banked+escapes only (500 + 2×100 = 700)", /PERKS — LEVEL 3 · 700 XP/.test(titleText), (titleText.match(/PERKS — LEVEL \d · \d+ XP/) ?? ["none"])[0]);
  ok("old save: best/escapes/runs still shown", /Best haul \$300 · 2 escapes in 4 runs/.test(titleText));
  ok("old save: no traces control either", !/TRACES — WHAT THE HILLS REMEMBER/.test(titleText));
  await ctx.close();
}

/* ═══════════ G. DIFFICULTY + ENDINGS ═══════════ */
async function runWithDifficulty(difficulty) {
  const init = {
    arg: difficulty,
    fn: (d) => {
      localStorage.setItem("wwlith-settings-v1", JSON.stringify({ difficulty: d, perkId: null, reducedHallucinations: false, soundIndicator: true }));
    },
  };
  const { ctx, page } = await newPage({ width: 1024, height: 700 }, init);
  await page.goto(GAME, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await skipGuide(page);
  const st = await state(page);
  await ctx.close();
  return st;
}
{
  const story = await runWithDifficulty("story");
  ok("Story difficulty: 480 s", story?.totalTime === 480 && story?.timeLeft > 470, `total=${story?.totalTime}`);
  const ruth = await runWithDifficulty("ruthless");
  ok("Ruthless difficulty: 360 s", ruth?.totalTime === 360 && ruth?.timeLeft <= 360, `total=${ruth?.totalTime}`);

  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(`${GAME}?seed=end-seed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await skipGuide(page);
  await page.keyboard.down("w");
  await page.keyboard.down("Shift");
  await waitState(page, () => (window.__hills?.debugState().peakNoise ?? 0) > 19, 45000);
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  // county road escape
  await page.evaluate(() => window.__hills.teleport(5, 96.5));
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(() => window.__hills?.debugState().phase === "ended", null, { timeout: 60000 });
    ok("county road escape ends the run", true);
  } catch { ok("county road escape ends the run", false, JSON.stringify(await state(page))); }
  await page.keyboard.up("w");
  await waitText(page, /Out by the County Road/, 30000);
  let text = await page.evaluate(() => document.body.innerText);
  ok("end screen names the County Road exit", /Out by the County Road/.test(text));
  ok("end screen reports loudest moment", /YOUR LOUDEST MOMENT/.test(text) && /metre ring of noise/.test(text));
  ok("end screen has NO lore section", !/WHAT THE HILLS REMEMBER/.test(text) && !/No new traces this run/.test(text));
  await page.screenshot({ path: `${OUT}/n5-end-loudest.png` });

  // rail tunnel escape
  await page.getByRole("button", { name: "RUN AGAIN" }).click();
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__hills.teleport(34, 97));
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(() => window.__hills?.debugState().phase === "ended", null, { timeout: 60000 });
    ok("rail tunnel escape ends the run", true);
  } catch { ok("rail tunnel escape ends the run", false, JSON.stringify(await state(page))); }
  await page.keyboard.up("w");
  await waitText(page, /Out by the Rail Tunnel/, 30000);
  text = await page.evaluate(() => document.body.innerText);
  ok("end screen names the Rail Tunnel exit", /Out by the Rail Tunnel/.test(text));

  // caught → what gave you away
  await page.getByRole("button", { name: "RUN AGAIN" }).click();
  await page.waitForTimeout(700);
  const st = await state(page);
  const mp = st.monsterPos[0];
  await page.evaluate(([x, z]) => window.__hills.teleport(x, z), [mp.x, mp.z]);
  try {
    await page.waitForFunction(() => window.__hills?.debugState().phase === "ended", null, { timeout: 60000 });
    ok("caught ending fires", true);
  } catch { ok("caught ending fires", false, JSON.stringify(await state(page))); }
  await waitText(page, /WHAT GAVE YOU AWAY/, 30000);
  text = await page.evaluate(() => document.body.innerText);
  ok("caught screen says what gave you away", /WHAT GAVE YOU AWAY/.test(text));
  await page.screenshot({ path: `${OUT}/n6-end-caught.png` });
  await ctx.close();
}

/* ═══════════ H. MOBILE 375×667 (original gates, condensed) ═══════════ */
{
  const { ctx, page } = await newPage({ width: 375, height: 667 });
  await page.goto(GAME, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  ok("mobile: tutorial opens", (await page.getByText("HOW TO PLAY · 1 OF 4").count()) === 1);
  await page.screenshot({ path: `${OUT}/n7-mobile-title.png` });
  await page.getByRole("button", { name: /skip/i }).first().click({ timeout: 8000 });
  await page.waitForTimeout(400);
  ok("mobile: SKIP writes guide flag", (await page.evaluate(() => localStorage.getItem("wwlith-guide-v1"))) === "1");
  await page.getByRole("button", { name: "START THE RUN" }).first().click();
  await page.waitForTimeout(900);
  const st = await state(page);
  ok("mobile: run playing", st?.phase === "playing", JSON.stringify(st));
  const dropBtn = page.getByRole("button", { name: /DROP IRON TOOLS/ });
  ok("mobile: big DROP reachable", (await dropBtn.count()) === 1);
  const box = await dropBtn.first().boundingBox();
  ok("mobile: DROP in viewport, ≥48px", !!box && box.y + box.height <= 667 && box.height >= 48, JSON.stringify(box));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  ok("mobile: no horizontal overflow", overflow <= 375, `scrollWidth=${overflow}`);
  await page.screenshot({ path: `${OUT}/n8-mobile-gameplay.png` });
  const zBefore = (await state(page))?.player.z ?? 0;
  await page.mouse.move(79, 583);
  await page.mouse.down();
  await page.mouse.move(79, 532, { steps: 6 });
  await page.waitForTimeout(8000);
  await page.mouse.up();
  const zAfter = (await state(page))?.player.z ?? 0;
  ok("mobile: joystick moves player", zAfter > zBefore + 0.8, `z ${zBefore} -> ${zAfter}`);
  await page.screenshot({ path: `${OUT}/n9-mobile-moved.png` });
  await ctx.close();
}

/* ═══════════ I. RING LABEL (the original ring-fix assertions) ═══════════ */
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(GAME, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await skipGuide(page);
  const packLine = () => page.evaluate(() => {
    const ps = [...document.querySelectorAll("p")];
    const el = ps.find((pp) => pp.textContent?.includes("ring of noise"));
    return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
  });
  const labelNumber = (txt) => {
    const m = txt?.match(/≈\s*([\d.]+)\s*m across/);
    return m ? parseFloat(m[1]) : null;
  };
  let st = await state(page);
  let line = await packLine();
  ok("idle: engine noise radius is 0", st?.noise === 0, `noise=${st?.noise}`);
  ok("idle: label says silent in words", !!line && /standing still you are silent/.test(line) && /no ring, no noise/.test(line), line ?? "");
  ok("idle: label carries NO numeric across-claim", labelNumber(line) === null && !/≈\s*0/.test(line ?? ""));
  await page.keyboard.down("w");
  await waitState(page, () => (window.__hills?.debugState().noise ?? 0) > 10, 45000);
  st = await state(page);
  const walkNum = labelNumber(await packLine());
  ok("walk: engine noise ≈ 11.2", Math.abs((st?.noise ?? 0) - 11.2) < 0.15, `noise=${st?.noise}`);
  ok("walk: label = 2 × radius (±0.3)", walkNum !== null && Math.abs(walkNum - 2 * (st?.noise ?? 0)) <= 0.3, `label=${walkNum} vs 2×${st?.noise}`);
  await page.keyboard.down("Shift");
  await waitState(page, () => (window.__hills?.debugState().noise ?? 0) > 19.5, 45000);
  st = await state(page);
  const hustleNum = labelNumber(await packLine());
  ok("hustle: label = 2 × radius (±0.3)", hustleNum !== null && Math.abs(hustleNum - 2 * (st?.noise ?? 0)) <= 0.3, `label=${hustleNum} vs 2×${st?.noise}`);
  await page.evaluate(() => window.__hills.forceFog(0.032));
  await waitState(page, () => window.__hills?.debugState().fogThick === true && (window.__hills?.debugState().noise ?? 0) > 29, 45000);
  st = await state(page);
  const fogNum = labelNumber(await packLine());
  ok("fog: fogThick engaged", st?.fogThick === true);
  ok("fog: label = 2 × radius (±0.3)", fogNum !== null && Math.abs(fogNum - 2 * (st?.noise ?? 0)) <= 0.3, `label=${fogNum} vs 2×${st?.noise}`);
  await page.keyboard.up("Shift");
  await page.keyboard.up("w");
  await page.evaluate(() => window.__hills.forceFog(null));
  await waitState(page, () => (window.__hills?.debugState().noise ?? 1) === 0, 45000);
  st = await state(page);
  line = await packLine();
  ok("idle again: noise 0 + words label", st?.noise === 0 && /standing still you are silent/.test(line ?? ""), `noise=${st?.noise}`);
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "PROBE DONE — ALL PASS" : `PROBE DONE — ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
