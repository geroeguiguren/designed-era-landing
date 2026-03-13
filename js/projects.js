const grid = document.getElementById("mosaicGrid");
const viewport = document.getElementById("viewport");
const content = document.getElementById("content");
const navToggle = document.getElementById("navToggle");
const siteNav = document.getElementById("siteNav");

const CINEMATIC_MODE = false;

const baseImages = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
  43, 44, 45, 46, 47, 49
];

const pad2 = (n) => String(n).padStart(2, "0");
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function lerp(a, b, t){ return a + (b - a) * t; }

function isMobile(){
  return window.innerWidth <= 768;
}

function prefersReducedMotion(){
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let tiles = [];
let decodePromises = [];

let zoom = 1;
let zoomTarget = 1;
let zoomRAF = 0;
let zoomAnchor = null;

const ZOOM_MIN = 1;
const ZOOM_MAX = 1.65;

let introAnimating = false;

function getColCount(){
  const w = window.innerWidth;
  if (w <= 768) return 1;
  if (w <= 1100) return 4;
  if (w <= 1400) return 5;
  return 6;
}

function applyColCount(){
  grid.style.setProperty("--cols", String(getColCount()));
}

function renderTilesFromList(list){
  tiles = [];
  decodePromises = [];
  grid.innerHTML = "";

  list.forEach((num) => {
    const tile = document.createElement("div");
    tile.className = "tile";

    const img = document.createElement("img");
    img.src = `./assets/home/${pad2(num)}.webp`;
    img.alt = `Designed Era ${num}`;
    img.loading = "eager";
    img.decoding = "async";
    img.draggable = false;

    tile.appendChild(img);
    grid.appendChild(tile);

    tiles.push(tile);
    if (img.decode) decodePromises.push(img.decode().catch(() => {}));
  });
}

async function ensureFillHeight(){
  const target = isMobile() ? 0 : viewport.clientHeight * 2.2;
  let repeats = isMobile() ? 1 : 1;

  while (repeats <= 8){
    const list = [];
    for (let r = 0; r < repeats; r++){
      for (const n of baseImages) list.push(n);
    }

    renderTilesFromList(list);

    await Promise.all(decodePromises);
    grid.offsetHeight;

    const h = grid.scrollHeight;
    if (isMobile() || h >= target) break;

    repeats++;
  }
}

function closeMenu(){
  siteNav.classList.remove("is-open");
  navToggle.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
}

function openMenu(){
  siteNav.classList.add("is-open");
  navToggle.classList.add("is-open");
  navToggle.setAttribute("aria-expanded", "true");
}

function bindMenu(){
  if (!navToggle || !siteNav) return;

  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.contains("is-open");
    if (isOpen) closeMenu();
    else openMenu();
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMenu();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

const drag = {
  isDown: false,
  startY: 0,
  startOffset: 0,
  offset: 0,
  maxOffset: 0,
  v: 0,
  lastY: 0,
  lastT: 0,
  raf: 0,
  inertiaRAF: 0
};

const cinematic = { x: 0, r: 0 };

function applyOffset(){
  if (isMobile()){
    content.style.transform = "none";
    return;
  }

  const y = (-drag.offset).toFixed(2);

  let cinX = 0;
  let cinR = 0;

  const canCinematic = CINEMATIC_MODE && !prefersReducedMotion();

  if (canCinematic){
    const vNorm = clamp(drag.v / 1600, -1, 1);
    const wave = Math.sin(drag.offset * 0.0022);

    const targetX = wave * 2 + vNorm * 1.2;
    const targetR = vNorm * 0.6;

    cinematic.x = lerp(cinematic.x, targetX, 0.12);
    cinematic.r = lerp(cinematic.r, targetR, 0.10);

    cinX = cinematic.x;
    cinR = cinematic.r;
  } else {
    cinematic.x = lerp(cinematic.x, 0, 0.18);
    cinematic.r = lerp(cinematic.r, 0, 0.18);
    cinX = cinematic.x;
    cinR = cinematic.r;
  }

  content.style.transform =
    `translate3d(${cinX.toFixed(2)}px, ${y}px, 0) rotate(${cinR.toFixed(3)}deg) scale(${zoom.toFixed(4)})`;
}

function measureLimits(){
  if (isMobile()){
    drag.maxOffset = 0;
    drag.offset = 0;
    return;
  }

  const vh = viewport.clientHeight;
  const ch = content.scrollHeight * zoom;
  drag.maxOffset = Math.max(0, ch - vh);
  drag.offset = clamp(drag.offset, 0, drag.maxOffset);
}

const FRICTION = 0.92;
const STOP_VELOCITY = 8;
const MAX_V = 3600;

function rubberDelta(delta, dimension){
  const d = Math.abs(delta);
  const sign = Math.sign(delta) || 1;
  const result = (d * 0.55 * dimension) / (dimension + 0.55 * d);
  return sign * result;
}

function stopInertia(){
  if (drag.inertiaRAF){
    cancelAnimationFrame(drag.inertiaRAF);
    drag.inertiaRAF = 0;
  }
}

function startInertia(){
  if (isMobile()) return;

  stopInertia();
  let prev = performance.now();

  const tick = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    drag.offset += drag.v * dt;

    if (drag.offset < 0){
      drag.offset = 0;
      drag.v = 0;
    } else if (drag.offset > drag.maxOffset){
      drag.offset = drag.maxOffset;
      drag.v = 0;
    }

    drag.v *= Math.pow(FRICTION, dt * 60);

    measureLimits();
    applyOffset();

    if (Math.abs(drag.v) < STOP_VELOCITY){
      drag.v = 0;
      drag.inertiaRAF = 0;
      return;
    }

    drag.inertiaRAF = requestAnimationFrame(tick);
  };

  drag.inertiaRAF = requestAnimationFrame(tick);
}

function springTo(target){
  if (isMobile()) return;

  stopInertia();

  let x = drag.offset;
  let v = drag.v;

  const k = 60;
  const c = 12;
  const EPS = 0.4;

  let prev = performance.now();

  const tick = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    const a = -k * (x - target) - c * v;
    v += a * dt;
    x += v * dt;

    drag.offset = x;
    drag.v = v;

    measureLimits();
    applyOffset();

    if (Math.abs(v) < EPS && Math.abs(x - target) < EPS){
      drag.offset = target;
      drag.v = 0;
      applyOffset();
      drag.inertiaRAF = 0;
      return;
    }

    drag.inertiaRAF = requestAnimationFrame(tick);
  };

  drag.inertiaRAF = requestAnimationFrame(tick);
}

function startZoomSmooth(){
  if (isMobile()) return;
  if (zoomRAF) return;

  let prev = performance.now();

  const tick = (now) => {
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;

    const SMOOTH = 12;
    const k = 1 - Math.exp(-SMOOTH * dt);

    zoom = zoom + (zoomTarget - zoom) * k;

    if (zoomAnchor){
      drag.offset = zoomAnchor.yContent - (zoomAnchor.cursorY / zoom);

      if (now > zoomAnchor.tEnd && Math.abs(zoomTarget - zoom) < 0.002){
        zoomAnchor = null;
      }
    }

    measureLimits();
    applyOffset();

    if (Math.abs(zoomTarget - zoom) < 0.00035){
      zoom = zoomTarget;
      zoomRAF = 0;
      measureLimits();
      applyOffset();
      return;
    }

    zoomRAF = requestAnimationFrame(tick);
  };

  zoomRAF = requestAnimationFrame(tick);
}

function normalizeWheel(e){
  let dy = e.deltaY;
  if (e.deltaMode === 1) dy *= 16;
  if (e.deltaMode === 2) dy *= window.innerHeight;
  return dy;
}

function bindWheelZoom(){
  viewport.addEventListener("wheel", (e) => {
    if (isMobile()) return;
    if (previewOpen || previewAnimating) return;

    e.preventDefault();

    let dy = normalizeWheel(e);
    dy = clamp(dy, -180, 180);

    const rect = viewport.getBoundingClientRect();
    const cursorY = e.clientY - rect.top;

    const yContent = drag.offset + (cursorY / zoom);
    zoomAnchor = { yContent, cursorY, tEnd: performance.now() + 220 };

    const step = 1.045;
    const notch = -dy / 120;
    zoomTarget = clamp(zoomTarget * Math.pow(step, notch), ZOOM_MIN, ZOOM_MAX);

    startZoomSmooth();
  }, { passive: false });
}

function bindDrag(){
  bindWheelZoom();

  viewport.addEventListener("pointerdown", (e) => {
    if (isMobile()) return;
    if (previewOpen || previewAnimating) return;
    if (e.target.closest(".tile img")) return;

    stopInertia();
    drag.isDown = true;
    viewport.classList.add("is-grabbing");
    viewport.setPointerCapture(e.pointerId);

    drag.startY = e.clientY;
    drag.startOffset = drag.offset;
    drag.lastY = e.clientY;
    drag.lastT = performance.now();
    drag.v *= 0.25;
  });

  viewport.addEventListener("pointermove", (e) => {
    if (isMobile()) return;
    if (!drag.isDown) return;

    const dy = e.clientY - drag.startY;
    let next = drag.startOffset - dy;

    if (next < 0){
      next = rubberDelta(next, viewport.clientHeight);
    } else if (next > drag.maxOffset){
      next = drag.maxOffset + rubberDelta(next - drag.maxOffset, viewport.clientHeight);
    }

    drag.offset = next;

    const now = performance.now();
    const dt = Math.max(0.001, (now - drag.lastT) / 1000);
    const dyNow = e.clientY - drag.lastY;
    const vNow = (-dyNow) / dt;

    drag.v = drag.v * 0.82 + vNow * 0.18;
    drag.v = clamp(drag.v, -MAX_V, MAX_V);

    drag.lastY = e.clientY;
    drag.lastT = now;

    if (!drag.raf){
      drag.raf = requestAnimationFrame(() => {
        drag.raf = 0;
        measureLimits();
        applyOffset();
      });
    }
  });

  function endDrag(){
    if (isMobile()) return;
    if (!drag.isDown) return;

    drag.isDown = false;
    viewport.classList.remove("is-grabbing");

    if (drag.offset < 0) return springTo(0);
    if (drag.offset > drag.maxOffset) return springTo(drag.maxOffset);

    if (Math.abs(drag.v) > STOP_VELOCITY){
      startInertia();
    } else {
      drag.v = 0;
      measureLimits();
      applyOffset();
    }
  }

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
}

function enableMagneticHover(){
  if (isMobile()) return;

  let activeTile = null;
  let raf = 0;

  grid.addEventListener("pointerenter", () => {
    if (!isMobile()) grid.classList.add("is-hovering");
  });

  grid.addEventListener("pointerleave", () => {
    grid.classList.remove("is-hovering");
    if (activeTile){
      activeTile.style.setProperty("--mx", "0px");
      activeTile.style.setProperty("--my", "0px");
      activeTile = null;
    }
  });

  grid.addEventListener("pointermove", (e) => {
    if (isMobile()) return;
    if (previewOpen || previewAnimating) return;

    const t = e.target.closest(".tile");
    if (!t) return;

    activeTile = t;

    const rect = t.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const dx = (px - 0.5) * 2;
    const dy = (py - 0.5) * 2;

    const mx = dx * 10;
    const my = dy * 10;

    if (!raf){
      raf = requestAnimationFrame(() => {
        raf = 0;
        activeTile.style.setProperty("--mx", `${mx.toFixed(2)}px`);
        activeTile.style.setProperty("--my", `${my.toFixed(2)}px`);
      });
    }
  });
}

/* ============================= */
/* FLOATING PREVIEW */
/* ============================= */
let previewLayer = null;
let previewBackdrop = null;
let previewGhost = null;
let previewGhostImg = null;
let previewCloseBtn = null;
let activeOriginTile = null;
let activeOriginImg = null;
let previewOpen = false;
let previewAnimating = false;

function ensurePreview(){
  if (previewLayer) return;

  previewLayer = document.createElement("div");
  previewLayer.className = "preview-layer";

  previewBackdrop = document.createElement("div");
  previewBackdrop.className = "preview-backdrop";

  previewGhost = document.createElement("div");
  previewGhost.className = "preview-ghost";

  previewGhostImg = document.createElement("img");

  previewCloseBtn = document.createElement("button");
  previewCloseBtn.className = "preview-close";
  previewCloseBtn.type = "button";
  previewCloseBtn.setAttribute("aria-label", "Close preview");
  previewCloseBtn.textContent = "×";

  previewGhost.appendChild(previewGhostImg);
  previewLayer.appendChild(previewBackdrop);
  previewLayer.appendChild(previewGhost);
  previewLayer.appendChild(previewCloseBtn);
  document.body.appendChild(previewLayer);

  previewBackdrop.addEventListener("click", closePreview);
  previewCloseBtn.addEventListener("click", closePreview);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && previewOpen){
      closePreview();
    }
  });
}

function getPreviewTargetRect(img){
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const naturalW = img.naturalWidth || 1600;
  const naturalH = img.naturalHeight || 1000;
  const ratio = naturalW / naturalH;

  const maxW = Math.min(vw * 0.46, 700);
  const maxH = Math.min(vh * 0.62, 520);

  let w = maxW;
  let h = w / ratio;

  if (h > maxH){
    h = maxH;
    w = h * ratio;
  }

  const left = (vw - w) / 2;
  const top = (vh - h) / 2;

  return { left, top, width: w, height: h };
}

function openPreview(img){
  if (previewAnimating || previewOpen) return;

  ensurePreview();

  const tile = img.closest(".tile");
  if (!tile) return;

  activeOriginTile = tile;
  activeOriginImg = img;

  const from = img.getBoundingClientRect();
  const to = getPreviewTargetRect(img);

  previewGhostImg.src = img.src;
  previewGhostImg.alt = img.alt || "";

  previewGhost.style.left = `${from.left}px`;
  previewGhost.style.top = `${from.top}px`;
  previewGhost.style.width = `${from.width}px`;
  previewGhost.style.height = `${from.height}px`;
  previewGhost.style.opacity = "1";

  activeOriginTile.classList.add("is-origin");
  document.body.classList.add("preview-active");
  previewLayer.classList.add("is-open");

  viewport.style.pointerEvents = "none";
  previewAnimating = true;

  if (prefersReducedMotion()){
    previewGhost.style.left = `${to.left}px`;
    previewGhost.style.top = `${to.top}px`;
    previewGhost.style.width = `${to.width}px`;
    previewGhost.style.height = `${to.height}px`;
    previewOpen = true;
    previewAnimating = false;
    return;
  }

  const anim = previewGhost.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: 1
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 1
      }
    ],
    {
      duration: 520,
      easing: "cubic-bezier(.16,.95,.2,1)",
      fill: "forwards"
    }
  );

  anim.finished.catch(() => {}).finally(() => {
    previewGhost.style.left = `${to.left}px`;
    previewGhost.style.top = `${to.top}px`;
    previewGhost.style.width = `${to.width}px`;
    previewGhost.style.height = `${to.height}px`;
    previewOpen = true;
    previewAnimating = false;
  });
}

function closePreview(){
  if (!previewOpen || previewAnimating || !activeOriginImg || !activeOriginTile) return;

  const to = activeOriginImg.getBoundingClientRect();
  const from = previewGhost.getBoundingClientRect();

  previewAnimating = true;

  previewLayer.classList.remove("is-open");
  document.body.classList.remove("preview-active");

  if (prefersReducedMotion()){
    previewGhost.style.opacity = "0";
    previewGhostImg.src = "";
    previewGhostImg.alt = "";

    activeOriginTile.classList.remove("is-origin");
    activeOriginTile = null;
    activeOriginImg = null;

    viewport.style.pointerEvents = "";
    previewOpen = false;
    previewAnimating = false;
    return;
  }

  const anim = previewGhost.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: 1
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 1
      }
    ],
    {
      duration: 460,
      easing: "cubic-bezier(.16,.95,.2,1)",
      fill: "forwards"
    }
  );

  anim.finished.catch(() => {}).finally(() => {
    previewGhost.style.opacity = "0";
    previewGhostImg.src = "";
    previewGhostImg.alt = "";

    activeOriginTile.classList.remove("is-origin");
    activeOriginTile = null;
    activeOriginImg = null;

    viewport.style.pointerEvents = "";
    previewOpen = false;
    previewAnimating = false;
  });
}

let tap = null;

function onPointerDownForPreview(e){
  if (introAnimating) return;
  if (previewOpen || previewAnimating) return;

  const img = e.target.closest(".tile img");
  if (!img) return;

  tap = { img, x: e.clientX, y: e.clientY };
}

function onPointerMoveForPreview(e){
  if (!tap) return;
  const dx = e.clientX - tap.x;
  const dy = e.clientY - tap.y;
  if ((dx * dx + dy * dy) > (8 * 8)) tap = null;
}

function onPointerUpForPreview(){
  if (!tap) return;
  openPreview(tap.img);
  tap = null;
}

function bindPreviewEvents(){
  viewport.addEventListener("pointerdown", onPointerDownForPreview, true);
  viewport.addEventListener("pointermove", onPointerMoveForPreview, true);
  viewport.addEventListener("pointerup", onPointerUpForPreview, true);
  viewport.addEventListener("pointercancel", () => { tap = null; }, true);
}

async function runSequence(){
  applyColCount();
  await ensureFillHeight();

  enableMagneticHover();

  zoom = 1;
  zoomTarget = 1;

  measureLimits();
  drag.offset = 0;
  applyOffset();

  document.body.classList.add("mosaic-ready");
  introAnimating = false;
}

function init(){
  applyColCount();
  bindMenu();
  bindDrag();
  bindPreviewEvents();
  runSequence();
}

init();

let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(async () => {
    applyColCount();
    await ensureFillHeight();

    zoom = 1;
    zoomTarget = 1;
    drag.offset = 0;
    drag.v = 0;

    measureLimits();
    applyOffset();

    if (previewOpen){
      closePreview();
    }
  }, 150);
});