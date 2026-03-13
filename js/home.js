const grid = document.getElementById("mosaicGrid");
const headline = document.querySelector(".mosaic__headline");
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
function rand(min, max){ return Math.random() * (max - min) + min; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function lerp(a, b, t){ return a + (b - a) * t; }

function isMobile(){
  return window.innerWidth <= 768;
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

function prefersReducedMotion(){
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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


function createFlyLayer(){
  const layer = document.createElement("div");
  layer.className = "fly-layer";
  document.body.appendChild(layer);
  return layer;
}

function animateImages(){
  introAnimating = true;

  if (prefersReducedMotion() || isMobile()){
    document.body.classList.add("mosaic-ready");
    introAnimating = false;
    return;
  }

  const layer = createFlyLayer();
  const finalRects = tiles.map(t => t.getBoundingClientRect());

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  const anims = [];

  finalRects.forEach((r, i) => {
    const srcImg = tiles[i].querySelector("img");

    const fly = document.createElement("div");
    fly.className = "fly-tile";
    fly.style.width = `${r.width}px`;
    fly.style.height = `${r.height}px`;

    const startFromOutside = Math.random() < 0.7;
    let sx, sy;

    if (startFromOutside){
      const side = Math.floor(rand(0, 4));
      if (side === 0) { sx = rand(-200, window.innerWidth + 200); sy = rand(-400, -120); }
      if (side === 1) { sx = rand(window.innerWidth + 120, window.innerWidth + 420); sy = rand(-200, window.innerHeight + 200); }
      if (side === 2) { sx = rand(-200, window.innerWidth + 200); sy = rand(window.innerHeight + 120, window.innerHeight + 420); }
      if (side === 3) { sx = rand(-420, -120); sy = rand(-200, window.innerHeight + 200); }
    } else {
      sx = cx + rand(-220, 220);
      sy = cy + rand(-160, 160);
    }

    const fx = r.left;
    const fy = r.top;

    fly.style.left = `${sx}px`;
    fly.style.top = `${sy}px`;

    const img = document.createElement("img");
    img.src = srcImg.src;
    img.alt = srcImg.alt;

    fly.appendChild(img);
    layer.appendChild(fly);

    const dist = Math.hypot((r.left + r.width / 2) - cx, (r.top + r.height / 2) - cy);
    const maxDist = Math.hypot(cx, cy);
    const wave = dist / maxDist;

    const delay = Math.round(120 + wave * 520 + i * 6);
    const duration = 1500;

    const a = fly.animate(
      [
        { transform: `translate3d(0,0,0) scale(${rand(0.25, 0.55).toFixed(2)})`, opacity: 0, filter: "blur(10px)" },
        { transform: `translate3d(${(fx - sx) * 0.85}px, ${(fy - sy) * 0.85}px, 0) scale(1.04)`, opacity: 1, filter: "blur(2px)", offset: 0.78 },
        { transform: `translate3d(${(fx - sx)}px, ${(fy - sy)}px, 0) scale(1)`, opacity: 1, filter: "blur(0px)" }
      ],
      { duration, delay, easing: "cubic-bezier(.16,.95,.2,1)", fill: "forwards" }
    );

    anims.push(a);
  });

  Promise.all(anims.map(a => a.finished.catch(() => {}))).finally(() => {
    document.body.classList.add("mosaic-ready");
    layer.remove();
    introAnimating = false;
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


let lightboxEl = null;
let lightboxImg = null;

function openLightbox(src, alt){
  if (!lightboxEl){
    lightboxEl = document.createElement("div");
    lightboxEl.className = "lightbox";
    lightboxEl.setAttribute("role", "dialog");
    lightboxEl.setAttribute("aria-modal", "true");

    const btn = document.createElement("button");
    btn.className = "lightbox__close";
    btn.type = "button";
    btn.setAttribute("aria-label", "Close image");
    btn.textContent = "×";

    lightboxImg = document.createElement("img");
    lightboxImg.className = "lightbox__img";

    lightboxEl.appendChild(btn);
    lightboxEl.appendChild(lightboxImg);
    document.body.appendChild(lightboxEl);

    lightboxEl.addEventListener("click", (e) => {
      if (e.target === lightboxEl) closeLightbox();
    });

    btn.addEventListener("click", closeLightbox);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightboxEl.classList.contains("is-open")){
        closeLightbox();
      }
    });
  }

  lightboxImg.src = src;
  lightboxImg.alt = alt || "";

  viewport.style.pointerEvents = "none";
  requestAnimationFrame(() => lightboxEl.classList.add("is-open"));
}

function closeLightbox(){
  if (!lightboxEl) return;

  lightboxEl.classList.remove("is-open");
  viewport.style.pointerEvents = "";

  setTimeout(() => {
    if (!lightboxEl.classList.contains("is-open")){
      lightboxImg.src = "";
      lightboxImg.alt = "";
    }
  }, 250);
}

let tap = null;

function onPointerDownForLightbox(e){
  if (introAnimating) return;
  if (lightboxEl && lightboxEl.classList.contains("is-open")) return;

  const img = e.target.closest(".tile img");
  if (!img) return;

  tap = { img, x: e.clientX, y: e.clientY };
}

function onPointerMoveForLightbox(e){
  if (!tap) return;
  const dx = e.clientX - tap.x;
  const dy = e.clientY - tap.y;
  if ((dx * dx + dy * dy) > (8 * 8)) tap = null;
}

function onPointerUpForLightbox(){
  if (!tap) return;
  openLightbox(tap.img.src, tap.img.alt);
  tap = null;
}

viewport.addEventListener("pointerdown", onPointerDownForLightbox, true);
viewport.addEventListener("pointermove", onPointerMoveForLightbox, true);
viewport.addEventListener("pointerup", onPointerUpForLightbox, true);
viewport.addEventListener("pointercancel", () => { tap = null; }, true);


async function runSequence(){
  requestAnimationFrame(() => headline.classList.add("is-in"));

  const HEADLINE_MS = 1200;
  const GAP = 150;

  setTimeout(async () => {
    headline.classList.add("dim");

    applyColCount();
    await ensureFillHeight();

    enableMagneticHover();

    zoom = 1;
    zoomTarget = 1;

    measureLimits();
    drag.offset = 0;
    applyOffset();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        animateImages();

        if (!isMobile()){
          setTimeout(() => headline.classList.add("is-out"), 900);
        }
      });
    });
  }, HEADLINE_MS + GAP);
}

function init(){
  applyColCount();
  bindMenu();
  bindDrag();
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
  }, 150);
});