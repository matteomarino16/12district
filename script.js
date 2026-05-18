const year = document.getElementById("year");

if (year) year.textContent = String(new Date().getFullYear());

const clamp = (min, value, max) => Math.max(min, Math.min(value, max));

const rectsIntersect = (a, b, padding = 0) => {
  const leftA = a.left - padding;
  const rightA = a.right + padding;
  const topA = a.top - padding;
  const bottomA = a.bottom + padding;

  const leftB = b.left - padding;
  const rightB = b.right + padding;
  const topB = b.top - padding;
  const bottomB = b.bottom + padding;

  return leftA < rightB && rightA > leftB && topA < bottomB && bottomA > topB;
};

const getAvoidRects = () => {
  const selectors = [".card", ".topbar", ".footer"];
  return selectors
    .map((sel) => document.querySelector(sel))
    .filter(Boolean)
    .map((el) => el.getBoundingClientRect());
};

const pickRandomPosition = ({ width, height, avoidRects }) => {
  const padding = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const minX = padding;
  const minY = padding;
  const maxX = Math.max(minX, vw - width - padding);
  const maxY = Math.max(minY, vh - height - padding);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const x = Math.round(minX + Math.random() * (maxX - minX));
    const y = Math.round(minY + Math.random() * (maxY - minY));
    const candidate = { left: x, top: y, right: x + width, bottom: y + height };

    const collides = avoidRects.some((r) => rectsIntersect(candidate, r, 12));
    if (!collides) return { x, y };
  }

  return { x: minX, y: minY };
};

const createStickerPeel = ({
  imageSrc,
  width = 160,
  rotate = 0,
  peelBackHoverPct = 21,
  peelBackActivePct = 23,
  shadowIntensity = 0.5,
  peelDirection = 0,
  initialPosition = null
}) => {
  if (typeof window.__stickerZ__ !== "number") window.__stickerZ__ = 0;

  const root = document.createElement("div");
  root.className = "sticker-peel";
  root.style.setProperty("--sticker-width", `${width}px`);
  root.style.setProperty("--sticker-rotate", `${rotate}deg`);
  root.style.setProperty("--sticker-peelback-hover", `${peelBackHoverPct}%`);
  root.style.setProperty("--sticker-peelback-active", `${peelBackActivePct}%`);
  root.style.setProperty("--sticker-shadow-opacity", String(shadowIntensity));
  root.style.setProperty("--peel-direction", `${peelDirection}deg`);

  const container = document.createElement("div");
  container.className = "sticker-container";

  const main = document.createElement("div");
  main.className = "sticker-main";

  const img = document.createElement("img");
  img.className = "sticker-image";
  img.src = imageSrc;
  img.alt = "";
  img.draggable = false;
  img.addEventListener("contextmenu", (e) => e.preventDefault());

  main.appendChild(img);

  const flap = document.createElement("div");
  flap.className = "sticker-flap";

  const flapImg = document.createElement("img");
  flapImg.className = "sticker-flap-image";
  flapImg.src = imageSrc;
  flapImg.alt = "";
  flapImg.draggable = false;
  flapImg.addEventListener("contextmenu", (e) => e.preventDefault());

  flap.appendChild(flapImg);

  container.appendChild(main);
  container.appendChild(flap);
  root.appendChild(container);

  const handleTouchStart = () => container.classList.add("touch-active");
  const handleTouchEnd = () => container.classList.remove("touch-active");
  container.addEventListener("touchstart", handleTouchStart, { passive: true });
  container.addEventListener("touchend", handleTouchEnd, { passive: true });
  container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

  let dragging = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let startX = 0;
  let startY = 0;

  const getCurrentXY = () => ({
    x: Number(root.style.getPropertyValue("--x").replace("px", "")) || 0,
    y: Number(root.style.getPropertyValue("--y").replace("px", "")) || 0
  });

  const setXY = ({ x, y }) => {
    root.style.setProperty("--x", `${Math.round(x)}px`);
    root.style.setProperty("--y", `${Math.round(y)}px`);
  };

  const setZ = () => {
    window.__stickerZ__ += 1;
    root.style.zIndex = String(100 + window.__stickerZ__);
  };

  const clampToViewport = ({ x, y }) => {
    const rect = root.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const allowOffscreen = 0.25;

    const minX = -rect.width * allowOffscreen;
    const maxX = vw - rect.width * (1 - allowOffscreen);
    const minY = -rect.height * allowOffscreen;
    const maxY = vh - rect.height * (1 - allowOffscreen);

    return { x: clamp(minX, x, maxX), y: clamp(minY, y, maxY) };
  };

  const onPointerDown = (e) => {
    if (!(e instanceof PointerEvent)) return;
    dragging = true;
    setZ();
    root.setPointerCapture(e.pointerId);

    const current = getCurrentXY();
    startX = current.x;
    startY = current.y;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    const nextX = startX + (e.clientX - startPointerX);
    const nextY = startY + (e.clientY - startPointerY);
    setXY(clampToViewport({ x: nextX, y: nextY }));
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
  };

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);

  const positionWhenReady = async () => {
    await new Promise((resolve) => {
      if (img.complete) resolve();
      else img.addEventListener("load", resolve, { once: true });
    });

    if (initialPosition && typeof initialPosition === "object") {
      setXY(clampToViewport({ x: initialPosition.x || 0, y: initialPosition.y || 0 }));
      return;
    }

    const rect = root.getBoundingClientRect();
    const avoidRects = getAvoidRects();
    const { x, y } = pickRandomPosition({ width: rect.width, height: rect.height, avoidRects });
    setXY(clampToViewport({ x, y }));
  };

  positionWhenReady();
  window.addEventListener("resize", () => setXY(clampToViewport(getCurrentXY())));

  return root;
};

const stickersRoot = document.getElementById("stickers");
if (stickersRoot) {
  const stickers = [
    createStickerPeel({
      imageSrc: "./adesivo1.png",
      width: 160,
      rotate: 0,
      peelBackHoverPct: 21,
      peelBackActivePct: 23,
      shadowIntensity: 0.5,
      peelDirection: 0
    }),
    createStickerPeel({
      imageSrc: "./adesivo2.png",
      width: 160,
      rotate: 0,
      peelBackHoverPct: 21,
      peelBackActivePct: 23,
      shadowIntensity: 0.5,
      peelDirection: 0
    })
  ];

  stickers.forEach((s) => stickersRoot.appendChild(s));
}
