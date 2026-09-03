// echov4ult homepage — forged V-shield (Three.js) + progressive media
// Loads as an ES module; the page is fully usable if this never runs.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Nav shadow on scroll ---------- */
const header = document.querySelector("header.site");
const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 24);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

/* ---------- Videos: play only while visible, never fight the battery ---------- */
const videos = Array.from(document.querySelectorAll("video[data-autoplay]"));
if (videos.length && "IntersectionObserver" in window && !reduced) {
  const vio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
    });
  }, { threshold: 0.2 });
  videos.forEach((v) => vio.observe(v));
}

/* ---------- Post count in the receipts rail follows the blog index ---------- */
const railCounts = document.querySelectorAll("[data-rail-post-count]");
if (railCounts.length && window.fetch) {
  fetch("/blog/", { credentials: "same-origin" }).then((r) => r.ok ? r.text() : "").then((html) => {
    if (!html) return;
    const n = new DOMParser().parseFromString(html, "text/html").querySelectorAll(".post-list .post-item").length;
    if (n) railCounts.forEach((el) => { el.textContent = n; });
  }).catch(() => {});
}

/* ---------- The shield ---------- */
const stage = document.querySelector(".shield-stage");
if (stage) {
  try { buildShield(stage); } catch (err) { /* fallback image stays visible */ }
}

function shieldPath(s, yShift) {
  // Shield outline traced from the brand mark: arched top, sharp shoulders, swept sides, single point.
  const p = new THREE.Shape();
  const y = (v) => v * s + yShift;
  const x = (v) => v * s;
  p.moveTo(x(-1.02), y(0.62));
  p.quadraticCurveTo(x(0), y(1.1), x(1.02), y(0.62));
  p.bezierCurveTo(x(1.0), y(0.0), x(0.62), y(-0.74), x(0), y(-1.12));
  p.bezierCurveTo(x(-0.62), y(-0.74), x(-1.0), y(0.0), x(-1.02), y(0.62));
  return p;
}

function buildShield(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const narrow = stage.clientWidth < 520;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0.05, 4.6);

  // Two light temperatures only, per BRAND.md: cyan (system acting) + amber (value delivered)
  scene.add(new THREE.AmbientLight(0x0a2a44, 1.2));
  const key = new THREE.DirectionalLight(0xd8f7ff, 2.4); key.position.set(2.2, 3.2, 4); scene.add(key);
  const rim = new THREE.PointLight(0xd29922, 14, 12, 2); rim.position.set(-2.6, -2.2, 2.4); scene.add(rim);
  const back = new THREE.PointLight(0x00cff0, 10, 12, 2); back.position.set(0, 0.6, -2.6); scene.add(back);

  const group = new THREE.Group();
  scene.add(group);

  const metal = new THREE.MeshPhysicalMaterial({
    color: 0x1ab4ff, metalness: 0.78, roughness: 0.2,
    emissive: 0x0078cc, emissiveIntensity: 0.55,
    clearcoat: 0.7, clearcoatRoughness: 0.18,
  });

  // Ring: outer shield minus inner shield
  const ring = shieldPath(1, 0);
  ring.holes.push(shieldPath(0.84, -0.02));
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3, curveSegments: 48 });
  ringGeo.center();
  const ringMesh = new THREE.Mesh(ringGeo, metal);
  group.add(ringMesh);

  // The V: chunky, machined facets from a deep bevel
  const v = new THREE.Shape();
  [[-0.70, 0.50], [-0.36, 0.50], [0, -0.28], [0.36, 0.50], [0.70, 0.50], [0.10, -0.84], [0, -0.96], [-0.10, -0.84]]
    .forEach(([x, y], i) => (i ? v.lineTo(x, y) : v.moveTo(x, y)));
  const vGeo = new THREE.ExtrudeGeometry(v, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.075, bevelSegments: 2 });
  vGeo.center();
  const vMesh = new THREE.Mesh(vGeo, metal);
  vMesh.position.set(0, -0.06, 0.12);
  group.add(vMesh);

  // Halo: additive sprites stand in for bloom (cheap on phones)
  const haloTex = makeHalo();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x00cff0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(2.6, 2.6, 1); halo.position.z = -0.5; group.add(halo);
  const halo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0x0090f0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo2.scale.set(1.7, 1.7, 1); halo2.position.z = 0.3; group.add(halo2);

  // Vault particles: a slow drifting field behind the mark
  const N = narrow ? 260 : 460;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 1.6 + Math.random() * 3.2, a = Math.random() * Math.PI * 2, z = -2.5 + Math.random() * 3;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r * 0.8; pos[i * 3 + 2] = z;
  }
  const dots = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: 0x8fe6ff, size: 0.022, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
  );
  scene.add(dots);

  // Interaction state
  const target = { yaw: 0, pitch: 0.06 };
  const cur = { yaw: -0.6, pitch: 0.3 };
  let dragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0, userYaw = 0, userPitch = 0;
  const fine = window.matchMedia("(pointer: fine)").matches;

  if (fine) {
    window.addEventListener("pointermove", (e) => {
      const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
      userYaw = nx * 0.7; userPitch = ny * 0.35;
    }, { passive: true });
  }
  stage.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; velX = velY = 0; stage.classList.add("dragging"); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
    velX = dx * 0.006; velY = dy * 0.004; userYaw += velX; userPitch += velY;
    userPitch = Math.max(-0.7, Math.min(0.7, userPitch));
  });
  const endDrag = () => { dragging = false; stage.classList.remove("dragging"); };
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);

  // Resize
  const fit = () => {
    const w = stage.clientWidth, h = stage.clientHeight || w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.z = w < 420 ? 5.2 : 4.6;
  };
  fit();
  new ResizeObserver(fit).observe(stage);

  // Run only while on screen and the tab is visible
  let visible = true, hidden = document.hidden, raf = 0, t0 = performance.now(), booted = false;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; loop(); }, { threshold: 0.05 });
  io.observe(stage);
  document.addEventListener("visibilitychange", () => { hidden = document.hidden; loop(); });

  function frame(now) {
    raf = 0;
    const t = (now - t0) / 1000;
    const intro = Math.min(1, t / 1.6), e = 1 - Math.pow(1 - intro, 3);
    group.scale.setScalar(0.7 + 0.3 * e);
    if (!dragging) { userYaw *= 0.94; userPitch *= 0.94; velX *= 0.9; }
    const autoYaw = reduced ? 0 : Math.sin(t * 0.32) * 0.34;
    const scrollTilt = Math.min(0.45, window.scrollY * 0.0008);
    target.yaw = autoYaw + userYaw; target.pitch = 0.06 + userPitch + scrollTilt;
    cur.yaw += (target.yaw - cur.yaw) * 0.06; cur.pitch += (target.pitch - cur.pitch) * 0.06;
    group.rotation.set(cur.pitch, cur.yaw, 0);
    group.position.y = reduced ? 0 : Math.sin(t * 0.8) * 0.04;
    metal.emissiveIntensity = 0.5 + Math.sin(t * 1.4) * 0.08;
    dots.rotation.z = t * 0.02; dots.rotation.y = cur.yaw * 0.25;
    renderer.render(scene, camera);
    if (!booted) { booted = true; stage.classList.add("ready"); }
    if (reduced && intro >= 1) return; // static mark once settled
    loop();
  }
  function loop() { if (!raf && visible && !hidden) raf = requestAnimationFrame(frame); }
  // First frame synchronously: the mark exists before the first animation tick (and in throttled tabs)
  frame(t0);
}

function makeHalo() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,255,255,.55)"); grd.addColorStop(0.6, "rgba(255,255,255,.12)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
