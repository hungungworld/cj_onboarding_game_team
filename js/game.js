/* ONLYONE 레시피를 찾아라: 게임 엔진 v2 (안내 팝업 + 마우스 모션) */
(function () {
  "use strict";

  const C = window.GAME;
  const G = C.guides;
  const KEY = "cj-escape-v2";
  const STEPS = ["prologue", "room1", "room2", "room3", "room4", "room5", "act2", "act3", "ending"];
  const STEP_LABEL = ["프롤로그", "로비", "회의실", "키친", "연구소", "라운지", "추리", "캡슐", "엔딩"];
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const main = $("#main");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ═════════ 상태 ═════════ */
  function fresh() {
    return {
      team: "", name: "", start: null, end: null, penalty: 0, hintsUsed: 0,
      scene: "start", solved: {}, items: [], hintLv: {}, wrong: {}, lockUntil: {},
      puzzle: {}, clearedAt: {}, role: null, act3Step: 0, act2: { q: {}, done: false, twist: 0 },
      endingStage: 0, letter: "", demo: false, seen: {}, enterAt: {}, alarmOff: false
    };
  }
  let S = load() || fresh();
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 실패해도 진행 */ }
    pushTeam();
  }

  /* ═════════ 조 공유 상태 (Supabase) ═════════
   * 아래 키는 조원 모두가 같은 값을 본다. 나머지(이름, 본 안내, 엔딩 단계, 편지)는 기기마다 따로.
   * 게임 코드는 예전처럼 S를 고치고 save()만 부르면, 바뀐 부분만 골라 서버로 보낸다. */
  const NET = window.NET;
  const TEAM_KEYS = ["start", "end", "penalty", "hintsUsed", "scene", "solved", "items", "hintLv", "wrong", "lockUntil", "puzzle", "act3Step", "act2", "clearedAt"];
  const online = () => !!(NET && NET.active && !S.demo);
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
  const teamPart = (src) => { const o = {}; TEAM_KEYS.forEach((k) => (o[k] = clone(src[k]))); return o; };
  let synced = null; // 서버에서 마지막으로 받은 조 상태

  function diffOps(a, b, path, depth, ops) {
    // 서버에 아직 없는 객체(예: 두 조원이 동시에 처음 만든 퍼즐 판)도 칸 단위로 보내서 서로 덮어쓰지 않게 한다
    if (isObj(a) && (isObj(b) || b == null) && depth < 3) {
      b = b || {};
      new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => {
        if (!same(a[k], b[k])) diffOps(a[k], b[k], path.concat(k), depth + 1, ops);
      });
    } else ops.push({ op: "set", p: path, v: a === undefined ? null : a });
  }
  function pushTeam() {
    if (!online() || !synced || S.scene === "start") return;
    const ops = [];
    TEAM_KEYS.forEach((k) => {
      const a = S[k], b = synced[k];
      if (same(a, b)) return;
      if ((k === "penalty" || k === "hintsUsed") && typeof a === "number") ops.push({ op: "inc", p: [k], v: a - (b || 0) });
      else if (k === "items") (a || []).forEach((it) => { if (!(b || []).some((x) => x.id === it.id)) ops.push({ op: "add", p: [k], v: it }); });
      else if ((k === "start" || k === "end") && a) ops.push({ op: "init", p: [k], v: a }); // 먼저 찍은 시각이 조 기록
      else diffOps(a, b, [k], 1, ops);
    });
    if (!ops.length) return;
    synced = teamPart(S);
    NET.apply(ops);
  }
  // 서버 상태를 S에 덮어쓴다. 빈 값은 처음 상태로
  function takeTeam(state) {
    const base = fresh();
    TEAM_KEYS.forEach((k) => (S[k] = state[k] === undefined || state[k] === null ? base[k] : clone(state[k])));
    if (!S.act2.q) S.act2.q = {};
    synced = teamPart(S);
  }

  /* ═════════ 글자 처리: 의미 단위 줄바꿈 ═════════ */
  // "\n" → 줄바꿈, 숫자+단위+조사는 한 덩어리로 묶어 중간에서 안 끊기게
  const UNIT = /(\+?\d[\d,.:]*\s?(?:주년|년|월|일|시|분|초|개|명|번|대|%|자리|자|원|회|위|층|기|호|종|억|조원|조|만|단계|인 \d+조)(?:에서|부터|까지|[을를이가은는의에도로와과만])?)/g;
  // 고유명사도 한 덩어리로 (CJ제일제당, CJ블로썸파크, 식품·BIO …)
  const NOUN = /((?:CJ|K-)[가-힣A-Za-z]+(?:[을를이가은는의에도로와과]|에서|으로)?|식품·BIO|정직 · 열정 · 창의 · 존중|인재 · ONLYONE · 상생)/g;
  const guardText = (t) => t.replace(UNIT, '<span class="nw">$1</span>')
    .split(/(<[^>]+>)/).map((p) => (p.startsWith("<") ? p : p.replace(NOUN, '<span class="nw">$1</span>'))).join("");

  // 디스플레이용 (가운데 정렬 3줄 이하): "\n"은 직접 줄바꿈
  function fix(s) {
    if (s == null) return "";
    return String(s)
      .split(/(<[^>]+>)/)
      .map((part) => (part.startsWith("<") ? part : guardText(part)))
      .join("")
      .replace(/\n/g, "<br>");
  }
  /* 대본 규칙: 한 줄 = 한 호흡
   * - 문단(블록) 하나가 4줄 이하면 대본에 적은 줄바꿈(\n)을 그대로 살린다 (대사·쪽지·메모·안내)
   * - 5줄 이상인 긴 문단만 줄바꿈을 지우고 너비에 맞춰 자동으로 감는다
   * - 문단은 <p>, <li> 같은 블록 태그 단위로 따로 센다 */
  const BLOCK = /(<\/?(?:p|li|ul|ol|div|table|tr|td|th)\b[^>]*>)/;
  const body = (s) => {
    if (s == null) return "";
    const out = String(s).split(BLOCK).map((seg) => {
      if (BLOCK.test(seg)) return seg;
      const n = (seg.match(/\n/g) || []).length + 1;
      return n <= 4 ? seg.replace(/[ \t]*\n[ \t]*/g, "\n") : seg.replace(/\s*\n\s*/g, " ");
    }).join("");
    return fix(out);
  };
  /* 지문(장면 설명·조작 안내·힌트): 연극 대본의 무대 지문처럼 쓴다
   * - 첫 문장(장소·핵심)은 혼자 한 줄 → 장면이 열리는 자리
   * - 나머지 문장은 이어 붙여 너비에 맞춰 자동으로 감긴다 (넓은 화면에서 줄이 뚝뚝 끊기지 않게)
   * - ①②③ 단계 안내는 단계마다 한 줄 */
  const prose = (s) => {
    if (s == null) return "";
    const lines = String(s).split(/\s*\n\s*/).filter(Boolean);
    if (lines.some((l) => /^[①-⑨]/.test(l))) {
      const steps = [];
      lines.forEach((l) => (/^[①-⑨]/.test(l) || !steps.length ? steps.push(l) : (steps[steps.length - 1] += " " + l)));
      return fix(steps.join("\n"));
    }
    const all = lines.join(" ");
    const m = all.match(/^(.+?[.!?])\s+(.+)$/);
    return fix(m ? m[1] + "\n" + m[2] : all);
  };
  // 좁은 카드 여러 장이 나란히 놓일 때(증언 카드): 길이와 상관없이 자동으로 감아 카드끼리 모양을 맞춘다
  const flow = (s) => fix(s == null ? "" : String(s).replace(/\s*\n\s*/g, " "));
  const lines = (arr) => arr.map((l) => `<span class="ln">${fix(l)}</span>`).join("");

  // 아이콘: 콘텐츠의 "ti-…" 값을 선 아이콘으로
  const ic = (v) => (v && String(v).startsWith("ti-") ? `<i class="ti ${v}" aria-hidden="true"></i>` : (v || ""));
  // 이름 첫 글자 아바타 (사람)
  const initial = (name) => `<span class="av-initial" aria-hidden="true">${esc(String(name).trim().charAt(0))}</span>`;

  // 말풍선: 화자 이름은 위에 따로, 따옴표 없이, 안은 왼쪽 정렬 + 자동 줄바꿈
  function say(who, text) {
    const sp = (C.speakers && C.speakers[who]) || { emoji: "ti-message-circle", kind: "person" };
    return `<div class="say say-${sp.kind}">
      <p class="say-who"><span class="say-av" aria-hidden="true">${ic(sp.emoji)}</span>${esc(who)}</p>
      <p class="say-body">${body(text)}</p></div>`;
  }
  // 스토리 장면: 문자열이면 가운데 내레이션(직접 줄바꿈), {who, text}면 말풍선
  const beat = (b, cls = "") => (typeof b === "string" ? `<p class="line ${cls}">${fix(b)}</p>` : `<div class="${cls}">${say(b.who, b.text)}</div>`);

  /* ═════════ 유틸 ═════════ */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function norm(s) { return String(s).normalize("NFC").replace(/\s+/g, "").toUpperCase(); }
  function hash(s) {
    let h = 0x811c9dc5;
    for (const ch of norm(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, "0");
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }
  // 기록 = 걸린 시간 + 힌트·오답 벌점
  function elapsed() { return S.start ? Math.max(0, ((S.end || Date.now()) - S.start) / 1000 + S.penalty) : 0; }
  // 지점을 푼 시각 (조별 '가장 먼저 연 조' 메달용). 먼저 기록된 시각을 지킨다
  function cleared(key) { if (!S.clearedAt) S.clearedAt = {}; if (!S.clearedAt[key]) S.clearedAt[key] = Date.now(); }
  function hasItem(id) { return S.items.some((i) => i.id === id); }
  function addItem(it) { if (it && !hasItem(it.id)) S.items.push(it); }
  function pz(id, init) { if (!S.puzzle[id]) S.puzzle[id] = init(); return S.puzzle[id]; }

  function toast(msg, kind = "", ms = 2600) {
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.innerHTML = fix(msg);
    $("#toasts").appendChild(t);
    setTimeout(() => t.classList.add("out"), ms);
    setTimeout(() => t.remove(), ms + 500);
  }
  function shake(el) { if (!el) return; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
  function pop(el) { if (!el) return; el.classList.remove("bounce"); void el.offsetWidth; el.classList.add("bounce"); }

  // 포인터 잡기 (지원 안 되는 환경에서도 멈추지 않게)
  function capture(el, e) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } }

  /* ═════════ 포커스 가두기 (팝업 안에서만 Tab 이동) ═════════ */
  function trapFocus(box, e) {
    if (e.key !== "Tab") return;
    const f = $$("button, input, textarea, [tabindex]:not([tabindex='-1'])", box).filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ═════════ 일반 모달 (단서 보기) ═════════ */
  /* 팝업 두 종류 (ui-text-layout-rules.md §11-4)
   * - 기본(내용 창): 단서·힌트·제품 설명. 넓고, 모두 왼쪽 정렬
   * - dialog(확인 창): 메뉴·다시 하기처럼 짧은 알림과 질문. 좁고, 제목·문장·버튼 모두 가운데 */
  function openModal(title, html, onOpen, opts = {}) {
    $(".modal-box").classList.toggle("dialog", !!opts.dialog);
    $("#modal-title").innerHTML = fix(title);
    $("#modal-body").innerHTML = html;
    $("#modal").hidden = false;
    $("#modal-close").focus();
    if (onOpen) onOpen($("#modal-body"));
  }
  function closeModal() { $("#modal").hidden = true; }
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  $("#modal").addEventListener("keydown", (e) => trapFocus($(".modal-box"), e));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });

  /* ═════════════════════════════════════════
   *  안내 팝업
   * ═════════════════════════════════════════ */
  let guideOpen = false;

  // 카드 여러 장 또는 한 장짜리 안내. 닫히면 Promise가 풀림
  function guideCards(cards, { done = "알겠어요", warn = false, strict = false } = {}) {
    return new Promise((resolve) => {
      const wrap = $("#guide"), box = $("#guide-box");
      let i = 0;
      guideOpen = true;
      const close = () => {
        wrap.hidden = true; guideOpen = false;
        document.removeEventListener("keydown", onKey);
        resolve();
      };
      const draw = () => {
        const c = cards[i], lastCard = i === cards.length - 1;
        box.className = "guide-box" + (warn ? " warn" : "");
        box.innerHTML = `
          <div class="g-icon">${ic(c.icon)}</div>
          <h3 class="g-title">${fix(c.title)}</h3>
          <p class="g-lines">${lines(c.lines)}</p>
          ${cards.length > 1 ? `<div class="g-dots">${cards.map((_, k) => `<span class="${k === i ? "on" : ""}"></span>`).join("")}</div>` : ""}
          <div class="g-actions">
            ${i > 0 ? `<button class="btn" id="g-prev">이전</button>` : ""}
            <button class="btn primary" id="g-next">${lastCard ? done : "다음"}</button>
          </div>`;
        $("#g-next").onclick = () => { if (lastCard) close(); else { i++; draw(); } };
        const p = $("#g-prev"); if (p) p.onclick = () => { i--; draw(); };
        $("#g-next").focus();
      };
      const onKey = (e) => {
        trapFocus(box, e);
        if (e.key === "Escape" && !strict) close();
      };
      wrap.onclick = (e) => { if (e.target === wrap && !strict) close(); };
      document.addEventListener("keydown", onKey);
      wrap.hidden = false;
      draw();
    });
  }

  // 처음 한 번만 자동으로 띄우기
  async function guideOnce(id, cards, opts) {
    if (S.seen[id]) return;
    S.seen[id] = true; save();
    await guideCards(cards, opts);
  }

  /* ── ② 화면 사용법: 스포트라이트 ── */
  function coach() {
    return new Promise(async (resolve) => {
      const wrap = $("#coach"), hole = $("#coach-hole"), tip = $("#coach-tip");
      const steps = G.coach.filter((s) => $(s.target));
      let i = 0;
      guideOpen = true;
      const finish = () => { wrap.hidden = true; guideOpen = false; window.removeEventListener("resize", place); window.removeEventListener("scroll", onScroll, true); resolve(); };
      /* 스크롤해도 강조 상자가 대상을 따라가도록 (부드러운 스크롤 중에도 계속 맞춤) */
      let ticking = false;
      const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; place(); }); };
      const place = () => {
        const el = $(steps[i].target);
        if (!el) return;
        const r = el.getBoundingClientRect(), pad = 8;
        const L = r.left - pad, T = r.top - pad, W = r.width + pad * 2, H = r.height + pad * 2;
        Object.assign(hole.style, { left: L + "px", top: T + "px", width: W + "px", height: H + "px" });
        // 구멍 주변을 어둡게 덮는 사각형 4개 (위·아래·왼쪽·오른쪽)
        const [s1, s2, s3, s4] = $$(".c-shade", wrap);
        Object.assign(s1.style, { left: 0, top: 0, width: "100vw", height: Math.max(0, T) + "px" });
        Object.assign(s2.style, { left: 0, top: T + H + "px", width: "100vw", height: `calc(100vh - ${T + H}px)` });
        Object.assign(s3.style, { left: 0, top: T + "px", width: Math.max(0, L) + "px", height: H + "px" });
        Object.assign(s4.style, { left: L + W + "px", top: T + "px", width: `calc(100vw - ${L + W}px)`, height: H + "px" });
        const below = r.bottom + 180 < innerHeight;
        tip.style.left = Math.min(Math.max(12, r.left), innerWidth - tip.offsetWidth - 12) + "px";
        tip.style.top = (below ? r.bottom + 16 : Math.max(12, r.top - tip.offsetHeight - 16)) + "px";
      };
      const show = async () => {
        const el = $(steps[i].target);
        el.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" });
        await sleep(REDUCED ? 0 : 350);
        const last = i === steps.length - 1;
        tip.innerHTML = `
          <p class="c-step">${i + 1} / ${steps.length}</p>
          <p class="c-text">${fix(steps[i].text)}</p>
          <div class="g-actions">
            <button class="btn small" id="c-skip">건너뛰기</button>
            <button class="btn primary small" id="c-next">${last ? "시작!" : "다음"}</button>
          </div>`;
        place();
        $("#c-next").onclick = () => { if (last) finish(); else { i++; show(); } };
        $("#c-skip").onclick = finish;
        $("#c-next").focus();
      };
      window.addEventListener("resize", place);
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      wrap.hidden = false;
      show();
    });
  }

  /* ── ④ 조작법 시연: 손 모양 말풍선 ── */
  function demo(host, id, force) {
    const d = G.demos[id];
    if (!host || !d) return;
    if (!force && S.seen["demo-" + id]) return;
    if (!force && guideOpen) return; // 팝업이 떠 있으면 다음 기회에
    S.seen["demo-" + id] = true; save();
    $$(".demo-bubble", host).forEach((b) => b.remove());
    const b = document.createElement("div");
    b.className = "demo-bubble";
    b.innerHTML = `<span class="hand h-${d.kind}">${d.kind === "hold" || d.kind === "tap" ? '<i class="ti ti-hand-finger" aria-hidden="true"></i>' : '<i class="ti ti-hand-grab" aria-hidden="true"></i>'}</span><span>${fix(d.text)}</span>`;
    host.classList.add("has-demo");
    host.prepend(b);
    const kill = () => { b.classList.add("out"); setTimeout(() => b.remove(), 300); host.removeEventListener("pointerdown", kill); };
    host.addEventListener("pointerdown", kill);
    setTimeout(kill, 3800);
  }

  /* ── ⑥ 막힘 도움 ── */
  setInterval(() => {
    const sc = S.scene;
    if (!(sc.startsWith("room") || sc === "act2" || sc === "act3")) return;
    if (S.solved[sc] || S.seen["stuck-" + sc] || !S.enterAt[sc]) return;
    if (Date.now() - S.enterAt[sc] < 7 * 60 * 1000) return;
    S.seen["stuck-" + sc] = true; save();
    const n = $("#nudge");
    n.innerHTML = `<p>${lines(G.stuck)}</p><button class="x" aria-label="닫기"><i class="ti ti-x" aria-hidden="true"></i></button>`;
    n.hidden = false;
    $(".x", n).onclick = () => (n.hidden = true);
    setTimeout(() => (n.hidden = true), 12000);
  }, 15000);

  /* ── 장면에 들어갈 때 안내 순서 ── */
  async function sceneGuides() {
    const sc = S.scene;
    if (!S.enterAt[sc]) { S.enterAt[sc] = Date.now(); save(); }
    if (sc === "room1") {
      await guideOnce("act1", [G.acts.act1], { done: "시작하기" });
      if (!S.seen.coach) { S.seen.coach = true; save(); await coach(); }
    }
    if (sc === "act2") await guideOnce("act2", [G.acts.act2], { done: "시작하기" });
    if (sc === "act3" && (!S.role || online())) await guideOnce("act3", [G.acts.act3], { done: "시작하기" });
    if (sc === "act3" && online() && NET.members().length > 1) await guideOnce("roleRule", [G.roleRule], { warn: true, strict: true });
    runDemos();
  }
  // 지금 화면에 있는 조작법 시연을 띄움
  function runDemos(force) {
    const targets = $$("[data-demo]", main).filter((el) => el.offsetParent);
    if (force) { targets.forEach((el) => demo(el, el.dataset.demo, true)); return; }
    // 아직 안 본 조작법 중 화면 맨 위의 것 하나만
    const next = targets.find((el) => !S.seen["demo-" + el.dataset.demo]);
    if (next) demo(next, next.dataset.demo);
  }

  /* ═════════════════════════════════════════
   *  모션 엔진
   * ═════════════════════════════════════════ */

  /* ── 드래그 앤 드롭: 잡기 → 끌기(고스트) → 드롭 존 강조 → 스냅 / 스냅백 ──
   * opts.item: 끌 수 있는 요소, opts.zone: 놓을 수 있는 곳
   * opts.drop(itemEl, zoneEl) → "ok" | "bad"
   * opts.tap(itemEl): 끌지 않고 눌렀을 때 (클릭 대안)
   * opts.zoneTap(zoneEl): 놓을 곳을 눌렀을 때 (클릭 대안)
   */
  function dnd(root, opts) {
    $$(opts.item, root).forEach((el) => {
      el.classList.add("draggable");
      $$("img", el).forEach((im) => (im.draggable = false));
      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const start = { x: e.clientX, y: e.clientY };
        const r = el.getBoundingClientRect();
        const off = { x: e.clientX - r.left, y: e.clientY - r.top };
        let ghost = null, over = null;
        const move = (ev) => {
          if (!ghost) {
            if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
            ghost = el.cloneNode(true);
            ghost.classList.add("drag-ghost");
            Object.assign(ghost.style, { width: r.width + "px", height: r.height + "px" });
            document.body.appendChild(ghost);
            el.classList.add("dragging");
            document.body.classList.add("grabbing");
            $$(opts.zone, root).forEach((z) => z.classList.add("can-drop"));
          }
          ev.preventDefault();
          ghost.style.transform = `translate(${ev.clientX - off.x}px, ${ev.clientY - off.y}px) rotate(3deg) scale(1.05)`;
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          const z = hit && hit.closest(opts.zone);
          const zz = z && root.contains(z) && z !== el ? z : null;
          if (zz !== over) { over && over.classList.remove("over"); zz && zz.classList.add("over"); over = zz; }
        };
        const up = () => {
          removeEventListener("pointermove", move);
          removeEventListener("pointerup", up);
          removeEventListener("pointercancel", up);
          document.body.classList.remove("grabbing");
          el.classList.remove("dragging");
          $$(opts.zone, root).forEach((z) => z.classList.remove("can-drop", "over"));
          if (!ghost) { opts.tap && opts.tap(el); return; }
          const target = over;
          const res = target ? opts.drop(el, target) : "none";
          if (res === "ok") {
            const zr = target.getBoundingClientRect();
            flyGhost(ghost, zr.left + zr.width / 2 - r.width / 2, zr.top + zr.height / 2 - r.height / 2, true);
          } else {
            flyGhost(ghost, r.left, r.top, false);
            if (res === "bad") shake(target);
          }
        };
        addEventListener("pointermove", move, { passive: false });
        addEventListener("pointerup", up);
        addEventListener("pointercancel", up);
      });
      // 키보드(Enter/Space)로 누른 경우
      el.addEventListener("click", (e) => { if (e.detail === 0 && opts.tap) opts.tap(el); });
    });
    if (opts.zoneTap) $$(opts.zone, root).forEach((z) => z.addEventListener("click", () => opts.zoneTap(z)));
  }
  function flyGhost(ghost, x, y, ok) {
    if (REDUCED) { ghost.remove(); return; }
    ghost.style.transition = "transform .25s ease, opacity .25s ease";
    ghost.style.transform = `translate(${x}px, ${y}px) scale(${ok ? 0.5 : 1})`;
    ghost.style.opacity = ok ? "0" : "0.2";
    setTimeout(() => ghost.remove(), 260);
  }

  /* ── 길게 누르기: 원형 게이지가 다 차면 실행 ── */
  function longPress(btn, ms, done) {
    let t0 = 0, raf = 0;
    const stop = (reset = true) => {
      cancelAnimationFrame(raf); t0 = 0; btn.classList.remove("holding");
      if (reset) btn.style.setProperty("--p", 0);
    };
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      btn.style.setProperty("--p", p);
      if (p >= 1) { stop(false); done(); } else raf = requestAnimationFrame(step);
    };
    const start = (e) => {
      if (t0 || btn.disabled) return;
      e.preventDefault();
      t0 = performance.now(); btn.classList.add("holding");
      raf = requestAnimationFrame(step);
    };
    btn.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, () => { if (t0) stop(); }));
    btn.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) start(e); });
    btn.addEventListener("keyup", (e) => { if ((e.key === "Enter" || e.key === " ") && t0) stop(); });
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  const holdBtn = (label, cls = "") =>
    `<button class="btn hold ${cls}"><span class="ring"></span><span class="hold-label">${label}</span></button>`;

  /* ── 다이얼: 위아래로 끌기 · 휠 · ▲▼ · 방향키 ── */
  function dialLock(box, n, onTry) {
    const vals = Array(n).fill(0);
    box.innerHTML = `
      <div class="dials">${vals.map((_, i) => `
        <div class="dial" data-i="${i}" tabindex="0" role="spinbutton" aria-label="${i + 1}번째 숫자" aria-valuemin="0" aria-valuemax="9" aria-valuenow="0">
          <button class="d-up" tabindex="-1" aria-hidden="true">▲</button>
          <div class="d-win"><span class="d-prev">9</span><b class="d-cur">0</b><span class="d-next">1</span></div>
          <button class="d-down" tabindex="-1" aria-hidden="true">▼</button>
        </div>`).join("")}</div>
      <button class="btn primary" id="dial-go">열기</button>`;
    const set = (i, v) => {
      vals[i] = (v + 10) % 10;
      const d = $(`.dial[data-i="${i}"]`, box);
      $(".d-cur", d).textContent = vals[i];
      $(".d-prev", d).textContent = (vals[i] + 9) % 10;
      $(".d-next", d).textContent = (vals[i] + 1) % 10;
      d.setAttribute("aria-valuenow", vals[i]);
      d.classList.remove("tick"); void d.offsetWidth; d.classList.add("tick");
    };
    $$(".dial", box).forEach((d) => {
      const i = +d.dataset.i;
      $(".d-up", d).onclick = () => set(i, vals[i] + 1);
      $(".d-down", d).onclick = () => set(i, vals[i] - 1);
      d.addEventListener("wheel", (e) => { e.preventDefault(); set(i, vals[i] + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
      d.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); set(i, vals[i] + 1); }
        if (e.key === "ArrowDown") { e.preventDefault(); set(i, vals[i] - 1); }
        if (e.key === "Enter") tryIt();
      });
      const win = $(".d-win", d);
      win.addEventListener("pointerdown", (e) => {
        let last = e.clientY;
        capture(win, e);
        d.classList.add("turning");
        const mv = (ev) => {
          const dy = ev.clientY - last;
          if (Math.abs(dy) >= 22) { set(i, vals[i] + (dy < 0 ? 1 : -1)); last = ev.clientY; }
        };
        const upf = () => { d.classList.remove("turning"); win.removeEventListener("pointermove", mv); win.removeEventListener("pointerup", upf); };
        win.addEventListener("pointermove", mv);
        win.addEventListener("pointerup", upf);
      });
    });
    const tryIt = () => onTry(vals.join(""));
    $("#dial-go", box).onclick = tryIt;
  }

  /* ── 핀 누르기 ── */
  function pinLock(box, count, pick, onTry) {
    let seq = [];
    const draw = () => {
      box.innerHTML = `
        <div class="pinboard">${Array.from({ length: count }, (_, k) => k + 1).map((n) =>
          `<button class="pin ${seq.includes(n) ? "on" : ""}" data-pin="${n}" aria-label="${n}번 핀"><span class="pin-in"><b>${n}</b>${seq.includes(n) ? `<small>${seq.indexOf(n) + 1}번째</small>` : ""}</span></button>`).join("")}</div>
        <div class="row"><button class="btn small" id="pin-reset">다시 고르기</button><button class="btn primary" id="pin-go" ${seq.length < pick ? "disabled" : ""}>열기</button></div>`;
      $$("[data-pin]", box).forEach((b) => (b.onclick = () => {
        const n = +b.dataset.pin;
        if (seq.includes(n) || seq.length >= pick) return;
        seq.push(n); draw(); pop($(`[data-pin="${n}"]`, box));
      }));
      $("#pin-reset", box).onclick = () => { seq = []; draw(); };
      $("#pin-go", box).onclick = () => { const ok = onTry(seq.join("")); if (!ok) { seq = []; draw(); } };
    };
    draw();
  }

  /* ── 단어 조각 끼우기 ── */
  function pieceLock(box, lock, onTry) {
    const st = { slots: Array(lock.slots).fill(null), bank: shuffle(lock.pieces.map((_, i) => i)), sel: null };
    const draw = () => {
      const slotHtml = st.slots.map((p, i) =>
        `<button class="pslot ${p !== null ? "filled" : ""}" data-slot="${i}">${p !== null ? lock.pieces[p] : "&nbsp;"}</button>`).join(", ");
      box.innerHTML = `
        <p class="sentence">${fix(lock.before)}${slotHtml}${fix(lock.after)}</p>
        <div class="bank" data-demo="pieces">${st.bank.filter((p) => !st.slots.includes(p)).map((p) =>
          `<button class="piece ${st.sel === p ? "sel" : ""}" data-piece="${p}"><i class="ti ti-puzzle" aria-hidden="true"></i> ${lock.pieces[p]}</button>`).join("")}</div>
        <p class="alt-hint center"><i class="ti ti-hand-click" aria-hidden="true"></i>${body("끌기가 어려우면 조각을 누른 뒤 빈칸을 누르세요.")}</p>
        <div class="row"><button class="btn primary" id="piece-go" ${st.slots.includes(null) ? "disabled" : ""}>열기</button></div>`;
      const put = (p, slot) => {
        const prev = st.slots.indexOf(p); if (prev >= 0) st.slots[prev] = null;
        st.slots[slot] = p; st.sel = null; draw(); pop($(`[data-slot="${slot}"]`, box));
      };
      dnd(box, {
        item: "[data-piece]", zone: "[data-slot]",
        drop: (el, z) => { put(+el.dataset.piece, +z.dataset.slot); return "ok"; },
        tap: (el) => { st.sel = +el.dataset.piece; draw(); },
        zoneTap: (z) => {
          const i = +z.dataset.slot;
          if (st.sel !== null) put(st.sel, i);
          else if (st.slots[i] !== null) { st.slots[i] = null; draw(); }
        }
      });
      $("#piece-go", box).onclick = () => onTry(st.slots.map((p) => lock.pieces[p]).join(""));
    };
    draw();
  }

  /* ── 돋보기 (현미경) ── */
  function magnifier(box, html) {
    box.innerHTML = `
      <p class="note">${body("렌즈를 움직여\n흐릿한 슬라이드를 들여다보세요.")}</p>
      <div class="scope">
        <div class="sr-only">${body(html)}</div>
        <div class="slide blur" aria-hidden="true">${fix(html)}</div>
        <div class="slide sharp" aria-hidden="true">${fix(html)}</div>
        <div class="lens"></div>
      </div>`;
    const scope = $(".scope", box), sharp = $(".sharp", box), lens = $(".lens", box);
    const R = 70;
    const at = (x, y) => {
      sharp.style.clipPath = `circle(${R}px at ${x}px ${y}px)`;
      lens.style.transform = `translate(${x - R}px, ${y - R}px)`;
    };
    const mv = (e) => { const r = scope.getBoundingClientRect(); at(e.clientX - r.left, e.clientY - r.top); };
    scope.addEventListener("pointermove", mv);
    scope.addEventListener("pointerdown", mv);
    requestAnimationFrame(() => at(scope.clientWidth / 2, scope.clientHeight / 2));
  }

  /* ── 손전등 (보안실) ── */
  function flashlight(box, html, note) {
    box.innerHTML = `<p class="note">${prose(note)}</p><div class="darkroom">${html}<div class="torch" aria-hidden="true"></div></div>`;
    const room = $(".darkroom", box), torch = $(".torch", box);
    const mv = (e) => {
      const r = room.getBoundingClientRect();
      torch.style.setProperty("--x", e.clientX - r.left + "px");
      torch.style.setProperty("--y", e.clientY - r.top + "px");
    };
    room.addEventListener("pointermove", mv);
    room.addEventListener("pointerdown", mv);
  }

  /* ── 문지르기 (화이트보드) ── */
  function scratch(box, onReveal) {
    const cv = $("canvas", box);
    const r = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const x = cv.getContext("2d");
    x.scale(dpr, dpr);
    x.fillStyle = "#D9DEE2"; x.fillRect(0, 0, r.width, r.height);
    x.strokeStyle = "#B7BEC4"; x.lineWidth = 14; x.lineCap = "round";
    for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(10, 14 + k * 13); x.bezierCurveTo(r.width * .3, k * 9, r.width * .6, 30 + k * 12, r.width - 10, 10 + k * 14); x.stroke(); }
    x.globalCompositeOperation = "destination-out";
    let drawing = false, rubbed = 0, done = false;
    const rub = (e) => {
      if (!drawing) return;
      const b = cv.getBoundingClientRect();
      x.beginPath(); x.arc(e.clientX - b.left, e.clientY - b.top, 22, 0, Math.PI * 2); x.fill();
      rubbed++;
      if (rubbed > 45 && !done) { done = true; cv.classList.add("clear"); onReveal(); }
    };
    cv.addEventListener("pointerdown", (e) => { drawing = true; capture(cv, e); rub(e); });
    cv.addEventListener("pointermove", rub);
    cv.addEventListener("pointerup", () => (drawing = false));
  }

  /* ── 슬라이드 열기 ── */
  function slideOpen(box, label, onOpen) {
    box.innerHTML = `<div class="slider" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <span class="s-label">${label} →</span><span class="s-fill"></span><button class="s-knob" tabindex="-1" aria-hidden="true"><i class="ti ti-chevrons-right" aria-hidden="true"></i></button></div>`;
    const track = $(".slider", box), knob = $(".s-knob", box), fill = $(".s-fill", box);
    let p = 0, opened = false;
    const setP = (v, anim) => {
      p = Math.max(0, Math.min(1, v));
      const max = track.clientWidth - knob.offsetWidth - 8;
      knob.style.transition = fill.style.transition = anim ? "all .3s" : "none";
      knob.style.transform = `translateX(${p * max}px)`;
      fill.style.width = `${p * max + knob.offsetWidth / 2 + 4}px`;
      track.setAttribute("aria-valuenow", Math.round(p * 100));
      if (p >= 0.95 && !opened) { opened = true; track.classList.add("done"); onOpen(); }
    };
    knob.addEventListener("pointerdown", (e) => {
      capture(knob, e);
      const x0 = e.clientX, p0 = p, max = track.clientWidth - knob.offsetWidth - 8;
      const mv = (ev) => setP(p0 + (ev.clientX - x0) / max);
      const upf = () => { knob.removeEventListener("pointermove", mv); knob.removeEventListener("pointerup", upf); if (!opened) setP(0, true); };
      knob.addEventListener("pointermove", mv);
      knob.addEventListener("pointerup", upf);
    });
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") setP(p + 0.25, true);
      if (e.key === "ArrowLeft") setP(p - 0.25, true);
      if (e.key === "Enter" || e.key === "End") setP(1, true);
    });
    setP(0);
  }

  /* ═════════ 헤더 · 힌트 · 메뉴 ═════════ */
  function hintKey() {
    if (S.scene.startsWith("room")) return S.scene;
    if (S.scene === "act2" && !S.act2.done) return "act2";
    if (S.scene === "act3" && S.role && S.act3Step < C.act3.locks.length) return "act3-" + S.act3Step;
    return null;
  }
  function hintList(key) {
    if (!key) return null;
    if (key.startsWith("room")) return C.rooms.find((r) => r.id === key).hints;
    if (key === "act2") return C.act2.hints;
    return C.act3.locks[+key.split("-")[1]].hints;
  }
  function renderHeader() {
    const inGame = S.scene !== "start";
    $("#hud").hidden = !inGame;
    $("#progress").hidden = !inGame;
    if (!inGame) { $("#items").innerHTML = ""; return; }
    const idx = STEPS.indexOf(S.scene);
    $("#progress").innerHTML = STEPS.map((s, i) =>
      `<li class="${i < idx ? "done" : i === idx ? "now" : ""}" ${i === idx ? "aria-current=\"step\"" : ""}><span>${STEP_LABEL[i]}</span></li>`).join("");
    $("#items").innerHTML = S.items.map((i) => `<span class="item">${ic(i.icon)} ${esc(i.label)}</span>`).join("");
    const key = hintKey();
    $("#hint-btn").disabled = !key || !!S.solved[key];
    tick();
  }
  function tick() {
    $("#timer").textContent = fmt(elapsed());
    $("#penalty").textContent = S.penalty ? `(벌점 +${fmt(S.penalty)})` : "";
  }
  setInterval(tick, 1000);

  $("#hint-btn").addEventListener("click", () => {
    const key = hintKey(), list = hintList(key);
    if (!list) return;
    const show = () => {
      const lv = S.hintLv[key] || 0;
      let html = lv ? "" : `<p>${prose("막혔나요?\n힌트를 열면 기록에 벌점 시간이 더해져요.")}</p>`;
      for (let i = 0; i < lv; i++) html += `<div class="hint"><b>힌트 ${i + 1}</b><span>${prose(list[i])}</span></div>`;
      if (lv < list.length) {
        const cost = C.hintPenalty[lv] / 60;
        html += `<button class="btn primary" id="more-hint">${lv === list.length - 1 ? "정답 보기" : `힌트 ${lv + 1} 보기`} <span class="nw">(+${cost}분)</span></button>`;
      } else html += `<p class="note">모든 힌트를 열었어요.</p>`;
      $("#modal-body").innerHTML = html;
      const b = $("#more-hint");
      if (b) b.onclick = () => {
        S.penalty += C.hintPenalty[S.hintLv[key] || 0];
        S.hintLv[key] = (S.hintLv[key] || 0) + 1;
        S.hintsUsed++;
        save(); tick(); show();
      };
    };
    openModal('<i class="ti ti-bulb" aria-hidden="true"></i> 힌트', "", show);
  });

  /* ── ? 다시 보기 메뉴 ── */
  $("#help-btn").addEventListener("click", () => {
    const sc = S.scene;
    const act = sc.startsWith("room") ? "act1" : sc === "act2" ? "act2" : sc === "act3" ? "act3" : null;
    const inRoom = sc.startsWith("room") && $(".objects");
    const hasDemo = $$("[data-demo]", main).some((el) => el.offsetParent);
    openModal('<i class="ti ti-help" aria-hidden="true"></i> 안내 다시 보기', `
      <div class="help-menu">
        <button class="btn" data-h="rules"><i class="ti ti-users" aria-hidden="true"></i> 팀 플레이 규칙</button>
        <button class="btn" data-h="coach" ${inRoom ? "" : "disabled"}><i class="ti ti-pointer" aria-hidden="true"></i> 화면 사용법</button>
        <button class="btn" data-h="act" ${act ? "" : "disabled"}><i class="ti ti-target" aria-hidden="true"></i> 지금 막의 목표</button>
        <button class="btn" data-h="demo" ${hasDemo ? "" : "disabled"}><i class="ti ti-hand-grab" aria-hidden="true"></i> 지금 퍼즐 조작법</button>
      </div>`, (b) => {
      $$("[data-h]", b).forEach((x) => (x.onclick = async () => {
        closeModal();
        const h = x.dataset.h;
        if (h === "rules") await guideCards(G.rules.cards, { done: "알겠어요" });
        if (h === "coach") await coach();
        if (h === "act") await guideCards([G.acts[act]]);
        if (h === "demo") runDemos(true);
      }));
    });
  });

  /* 처음부터 다시: 브라우저 기본 confirm 창은 일부 브라우저(앱 안 브라우저 등)에서 뜨지 않아 게임 안 확인 창을 쓴다 */
  function askRestart() {
    const team = online();
    openModal('<i class="ti ti-refresh" aria-hidden="true"></i> ' + (team ? "입장 화면으로 나가기" : "처음부터 다시 하기"), `
      <p>${fix(team ? "조의 진행 기록은 그대로 남아요.\n같은 코드·조 이름으로 들어오면 이어서 해요." : "지금까지의 기록이 모두 지워져요.\n처음부터 다시 할까요?")}</p>
      <div class="row">
        <button class="btn" id="r-cancel">취소</button>
        <button class="btn primary" id="r-ok">${team ? "나가기" : "처음부터 다시"}</button>
      </div>`, (b) => {
      $("#r-cancel", b).onclick = closeModal;
      $("#r-ok", b).onclick = () => { const keep = { team: S.team, name: S.name }; S = fresh(); Object.assign(S, keep); save(); closeModal(); chatHide(); render(); window.scrollTo(0, 0); };
      setTimeout(() => $("#r-cancel", b).focus(), 50);
    }, { dialog: true });
  }

  $("#menu-btn").addEventListener("click", () => {
    openModal('<i class="ti ti-menu-2" aria-hidden="true"></i> 메뉴', `
      <p>${fix(online() ? `진행 상황은 ${S.team} 조원 모두와\n실시간으로 함께 저장돼요.` : "진행 상황은 이 브라우저에 자동 저장돼요.")}</p>
      <div class="row">
        <button class="btn" id="m-restart">${online() ? "입장 화면으로 나가기" : "처음부터 다시 하기"}</button>
        <button class="btn primary" id="m-close">계속하기</button>
      </div>`, (b) => {
      $("#m-close", b).onclick = closeModal;
      $("#m-restart", b).onclick = askRestart;
      setTimeout(() => $("#m-close", b).focus(), 50);
    }, { dialog: true });
  });

  /* ═════════ 장면 전환 ═════════ */
  function go(scene) {
    S.scene = scene;
    save();
    render();
    window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
  }
  function nextScene() { go(STEPS[STEPS.indexOf(S.scene) + 1]); }

  /* 다른 조원이 바꾼 상태가 도착했을 때: 장면이 바뀌었으면 바로, 아니면 조작이 끝난 뒤 다시 그림 */
  let pointerDown = false, softTimer = 0;
  addEventListener("pointerdown", () => (pointerDown = true), true);
  addEventListener("pointerup", () => (pointerDown = false), true);
  addEventListener("pointercancel", () => (pointerDown = false), true);
  const busy = () => pointerDown || guideOpen || document.body.classList.contains("grabbing") ||
    (document.activeElement && main.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName));
  function softRender() {
    clearTimeout(softTimer);
    softTimer = setTimeout(() => {
      if (busy()) return softRender();
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    }, 180);
  }
  if (NET) {
    NET.on("team", (state) => {
      if (!online() || S.scene === "start") return;
      const before = teamPart(S), prevScene = S.scene;
      takeTeam(state);
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ }
      if (same(before, teamPart(S))) return;
      if (S.scene !== prevScene) {
        if (prevScene && S.scene !== "prologue") toast(`${ic("ti-users")} 조원이 다음 장면으로 이동했어요.`, "good");
        render(); window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
      } else { renderHeader(); softRender(); }
    });
    // 조원 구성이 바뀔 때만 다시 그림 (단서 나눔·역할이 접속자 기준이라서)
    let lastRoster = "";
    NET.on("presence", () => {
      if (!online() || S.scene === "start") return;
      renderTeamBar();
      const roster = NET.members().map((p) => p.pid).join(",");
      if (roster !== lastRoster) { lastRoster = roster; softRender(); }
    });
  }

  function render() {
    document.body.classList.toggle("is-intro", S.scene === "start");
    if (online() && NET.scene !== S.scene) NET.track(S.scene);
    if (S.scene !== "start" && introStop) introStop();
    renderHeader();
    const fn = { start: renderStart, prologue: renderPrologue, act2: renderAct2, act3: renderAct3, ending: renderEnding }[S.scene];
    if (fn) fn();
    else if (S.scene.startsWith("room")) renderRoom(C.rooms.find((r) => r.id === S.scene));
    if (S.scene !== "start") setTimeout(sceneGuides, 60);
  }

  /* ═════════ 시작 화면: 끌어서 30년 건너기 (왼쪽 1996 → 오른쪽 2026) ═════════ */
  let introStop = null;
  /* ═════════ 처음 화면: 진행자 / 참가자 고르기 ═════════ */
  let roleChosen = false;
  function renderGate() {
    document.body.classList.add("at-gate");
    main.innerHTML = `
      <section class="gate" aria-labelledby="gate-title">
        <div class="gate-head">
          <img class="gate-logo" src="assets/ci/cj_logo_black.svg" alt="CJ제일제당">
          <p class="eyebrow">${esc(C.meta.subtitle)} · 팀 대항전</p>
          <h1 id="gate-title"><em>ONLYONE</em> 레시피를 찾아라</h1>
          <p>${fix("어떻게 참여하시나요?")}</p>
        </div>
        <div class="gate-roles">
          <button class="role-card primary" id="g-player">
            <span class="role-ic">${ic("ti-users")}</span>
            <b>참가자</b>
            <span>${fix("진행자에게 받은 입장 코드로\n조원과 함께 게임을 풀어요.")}</span>
            <span class="role-go">조에 입장하기 ${ic("ti-arrow-right")}</span>
          </button>
          <a class="role-card" id="g-host" href="host.html">
            <span class="role-ic">${ic("ti-presentation")}</span>
            <b>진행자</b>
            <span>${fix("회차를 열어 입장 코드를 만들고,\n조별 현황을 큰 화면에 띄워요.")}</span>
            <span class="role-go">진행자 화면 열기 ${ic("ti-arrow-right")}</span>
          </a>
        </div>
        <p class="gate-foot">${fix("참가자는 진행자가 보여 주는 링크나 QR로 들어오면\n이 화면 없이 바로 입장 화면이 열려요.")}</p>
      </section>`;
    $("#g-player").onclick = () => { roleChosen = true; document.body.classList.remove("at-gate"); renderStart(); };
  }

  function renderStart() {
    if (introStop) introStop();
    const saved = load();
    const net = NET ? NET.saved() : null;
    const canResume = !!(net && net.code && saved && saved.scene && saved.scene !== "start" && !saved.demo);
    const qsCode = new URLSearchParams(location.search).get("s") || "";
    const code0 = qsCode || (net && net.code) || "";
    // 처음 화면: 진행자인지 참가자인지 고른다. 참가 링크(?s=코드)로 왔거나 이어하기가 있으면 바로 참가자 화면
    if (!qsCode && !canResume && !roleChosen) return renderGate();
    const N = C.intro;
    main.innerHTML = `
      <section class="cine" id="cine">
        <div class="cine-layer then"><img src="${N.then.img}" alt="${esc(N.then.alt)}"></div>
        <div class="cine-layer now"><img class="cine-fill-img" src="${N.now.img}" alt="" aria-hidden="true"><img class="cine-main-img" src="${N.now.img}" alt="${esc(N.now.alt)}"></div>
        <div class="cine-grain" aria-hidden="true"></div><div class="cine-shade" aria-hidden="true"></div>
        <div class="cine-top">
          <div class="cine-brand"><img class="brand-logo" src="assets/ci/cj_logo_white.svg" alt="CJ제일제당"><span>신입 온보딩</span></div>
          <div class="cine-tools">
            <button class="cine-chip" id="c-auto">${ic("ti-player-play")} 자동으로 보기</button>
            <button class="cine-chip" id="c-skip">${ic("ti-player-skip-forward")} 건너뛰기</button>
            <button class="cine-chip" id="c-jump">${ic("ti-list")} 장면 바로 가기</button>
          </div>
        </div>
        <p class="cine-year" id="c-year" aria-live="polite">1996<small id="c-sub"></small></p>
        <div class="cine-beats" aria-live="polite">${N.beats.map((b, i) =>
          `<p class="cine-beat ${i === 0 ? "on" : ""}" data-until="${b.until}">${b.lines.map((l) => `<span>${fix(l)}</span>`).join("")}</p>`).join("")}</div>
        <div class="cine-track" id="c-track">
          <div class="cine-rail"></div><div class="cine-fill"></div>
          ${[1996, 2006, 2016, 2026].map((y, k) => `<i class="cine-tick ${k % 3 === 0 ? "end" : ""}" style="left:${(k * 100) / 3}%"><span>${y}</span></i>`).join("")}
          <span class="cine-hlabel" id="c-hlabel">오른쪽으로 끌어서 30년 건너오기 ${ic("ti-arrow-right")}</span>
          <button class="cine-handle" id="c-handle" role="slider" aria-label="1996년에서 2026년으로 넘기기" aria-valuemin="1996" aria-valuemax="2026" aria-valuenow="1996">${ic("ti-chevrons-right")}</button>
        </div>
        <section class="cine-arrive" aria-label="게임 입장">
          <p class="cine-kicker">${esc(C.meta.subtitle)} · 2026</p>
          <h1 class="cine-title"><em>ONLYONE</em><br>레시피를 찾아라</h1>
          <p class="cine-punch">${N.punch}</p>
          <div class="cine-entry">
            <label>입장 코드<input id="f-code" maxlength="4" inputmode="numeric" placeholder="숫자 4자리" value="${esc(code0)}"></label>
            <label>조 이름<input id="f-team" maxlength="20" placeholder="햇반 조" list="team-list" value="${esc((net && net.teamName) || S.team)}"><datalist id="team-list"></datalist></label>
            <label>내 이름<input id="f-name" maxlength="20" placeholder="홍길동" value="${esc((net && net.name) || S.name)}"></label>
            <button class="cine-go" id="b-start">조에 입장하기 ${ic("ti-arrow-right")}</button>
            ${canResume ? `<button class="cine-resume" id="b-resume">${ic("ti-history")} 이어하기 (${esc(net.teamName)})</button>` : ""}
            <p class="cine-msg" id="f-msg" role="alert"></p>
          </div>
          <p class="cine-meta"><span>${ic("ti-clock")} 약 45분</span><span>${ic("ti-users")} 조원과 동시 접속</span><span>${ic("ti-messages")} 조끼리, 전체가 함께 소통</span></p>
        </section>
      </section>`;

    const cine = $("#cine"), handle = $("#c-handle"), track = $("#c-track"), hlabel = $("#c-hlabel");
    const yearEl = $("#c-year"), subEl = $("#c-sub"), beats = $$(".cine-beat", cine);
    let p = 0, target = 0, dragging = false, done = false, alive = true, arriveTimer = 0, autoRun = 0;

    const draw = () => {
      cine.style.setProperty("--p", p.toFixed(4));
      handle.style.left = hlabel.style.left = p * 100 + "%";
      const y = Math.round(1996 + 30 * p);
      yearEl.firstChild.nodeValue = y;
      subEl.textContent = N.yearNotes[y] || `캡슐을 묻은 지 ${y - 1996}년`;
      handle.setAttribute("aria-valuenow", y);
      const idx = beats.findIndex((b) => p < +b.dataset.until);
      beats.forEach((b, i) => b.classList.toggle("on", i === idx));
      /* 2026에 닿으면 마지막 문장을 읽을 시간을 준 뒤 입장 화면 */
      if (p >= 0.995 && !done && !arriveTimer) arriveTimer = setTimeout(arrive, REDUCED ? 0 : 2600);
      if (p < 0.99 && arriveTimer) { clearTimeout(arriveTimer); arriveTimer = 0; }
    };
    const arrive = () => {
      done = true; p = target = 1; draw(); clearTimeout(arriveTimer);
      cine.classList.add("done");
      setTimeout(() => { const f = $("#f-name"); if (f && !S.name) f.focus({ preventScroll: true }); }, 700);
    };
    const setFromX = (x) => { const r = track.getBoundingClientRect(); target = Math.max(0, Math.min(1, (x - r.left) / r.width)); };

    handle.addEventListener("pointerdown", (e) => {
      if (done) return;
      dragging = true; autoRun++; cine.classList.add("dragged"); capture(handle, e);
    });
    handle.addEventListener("pointermove", (e) => { if (dragging) setFromX(e.clientX); });
    handle.addEventListener("pointerup", () => { dragging = false; if (target > 0.8) target = 1; });
    track.addEventListener("pointerdown", (e) => {
      if (done || e.target.closest("button")) return;
      autoRun++; cine.classList.add("dragged"); setFromX(e.clientX);
    });
    handle.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { cine.classList.add("dragged"); target = Math.min(1, target + 1 / 30); }
      if (e.key === "ArrowLeft") target = Math.max(0, target - 1 / 30);
      if (e.key === "End" || e.key === "Enter") target = 1;
    });

    /* 자동으로 보기: 1996 → 2010 → 2026, 문장마다 멈춤 */
    const moveTo = (to, run) => new Promise((res) => {
      const from = target, t0 = performance.now(), dur = REDUCED ? 1 : 1800;
      const ease = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
      (function step(now) {
        if (run !== autoRun || !alive) return res();
        const k = Math.min(1, (now - t0) / dur);
        target = from + (to - from) * ease(k);
        if (k < 1) requestAnimationFrame(step); else res();
      })(t0);
    });
    $("#c-auto").onclick = async () => {
      if (done) return;
      cine.classList.add("dragged");
      const run = ++autoRun;
      /* 1996: 이미 그 자리면 문장만 잠깐 보여 주고 바로 출발 (끌다가 눌렀으면 1996으로 되돌아감) */
      if (target > 0.01) await moveTo(0, run);
      await sleep(REDUCED ? 0 : 900);
      if (run !== autoRun) return;
      for (const stop of [0.4667, 1]) {
        await moveTo(stop, run);
        if (run !== autoRun) return;
        if (stop < 1) await sleep(REDUCED ? 0 : 2400); // 2010 문장 읽는 시간
        if (run !== autoRun) return;
      }
    };
    $("#c-skip").onclick = () => { autoRun++; arrive(); };
    $("#c-jump").onclick = () => openModal(`${ic("ti-list")} 장면 바로 가기`,
      `<p class="note">${fix("심사·데모용이에요. 고른 장면부터 바로 시작해요.")}</p>
       <ol class="jump-list">${[
         { act: "시작", name: "", ids: ["prologue"] },
         { act: "1막", name: "70년의 DNA", ids: ["room1", "room2", "room3", "room4", "room5"], num: true },
         { act: "2막", name: "사라진 레시피북", ids: ["act2"] },
         { act: "3막", name: "30주년 타임캡슐", ids: ["act3"] },
         { act: "끝", name: "", ids: ["ending"] }
       ].map((g) => `<li class="jump-row">
           <p class="jump-act"><b>${g.act}</b>${g.name ? `<span>${g.name}</span>` : ""}</p>
           <div class="jump-btns">${g.ids.map((id, k) => `<button class="btn small" data-jump="${id}">${g.num ? `<span class="jump-no">${k + 1}</span>` : ""}${STEP_LABEL[STEPS.indexOf(id)]}</button>`).join("")}</div>
         </li>`).join("")}</ol>`,
      (b) => $$("[data-jump]", b).forEach((x) => (x.onclick = () => { closeModal(); demoJump(x.dataset.jump); })));

    // 입장 코드를 넣으면 이미 만들어진 조 이름을 고를 수 있게
    const fCode = $("#f-code"), msgEl = $("#f-msg");
    const loadTeams = async () => {
      const c = fCode.value.trim();
      if (!/^\d{4}$/.test(c) || !NET) return;
      const { data: s } = await NET.db.from("sessions").select("id,title").eq("code", c).eq("status", "open").maybeSingle();
      if (!s) { msgEl.textContent = "입장 코드를 찾을 수 없어요. 진행자 화면의 숫자를 확인하세요."; return; }
      msgEl.textContent = s.title ? `「${s.title}」 회차에 들어가요.` : "";
      const { data: ts } = await NET.db.from("teams").select("name").eq("session_id", s.id).order("created_at");
      $("#team-list").innerHTML = (ts || []).map((t) => `<option value="${esc(t.name)}">`).join("");
    };
    fCode.addEventListener("input", loadTeams);
    if (code0) loadTeams();

    // 입장 → 조 상태 받기 → 조가 이미 시작했으면 그 장면으로 합류
    const enter = async (code, team, name, showRules) => {
      msgEl.textContent = "입장하는 중이에요…";
      let st;
      try { st = await NET.join(code, team, name); }
      catch (e) { msgEl.textContent = e.message || "입장하지 못했어요. 잠시 뒤 다시 시도하세요."; return; }
      msgEl.textContent = "";
      if (showRules) await guideCards(G.rules.cards, { done: G.rules.done, strict: true });
      introStop();
      const keep = saved && saved.team === team && saved.name === name && !saved.demo ? saved : null;
      S = fresh();
      if (keep) ["seen", "enterAt", "endingStage", "letter", "tab", "page"].forEach((k) => { if (keep[k] !== undefined) S[k] = keep[k]; });
      S.team = team; S.name = name; S.seen.rules = true;
      takeTeam(st.state || {});
      if (!S.start) { // 조에서 처음 들어온 사람이 시계를 켠다
        S.start = Date.now(); S.scene = "prologue";
        await NET.apply([{ op: "init", p: ["start"], v: S.start }, { op: "init", p: ["scene"], v: "prologue" }]);
      }
      if (S.scene === "start") S.scene = "prologue";
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ }
      chatInit();
      render(); window.scrollTo(0, 0);
      if (st.state && st.state.start) toast(`${ic("ti-users")} <b>${esc(team)}</b>에 합류했어요!`, "good");
    };
    $("#b-start").onclick = () => {
      const code = fCode.value.trim(), team = $("#f-team").value.trim(), name = $("#f-name").value.trim();
      if (!/^\d{4}$/.test(code)) { shake(fCode); fCode.focus(); msgEl.textContent = "진행자에게 받은 입장 코드 4자리를 넣으세요."; return; }
      if (!team) { shake($("#f-team")); $("#f-team").focus(); return; }
      if (!name) { shake($("#f-name")); $("#f-name").focus(); return; }
      enter(code, team, name, true);
    };
    const r = $("#b-resume");
    if (r) r.onclick = () => enter(net.code, net.teamName, net.name, false);

    (function loop() {
      if (!alive) return;
      if (!done) {
        p += (target - p) * (REDUCED ? 1 : 0.14);
        if (Math.abs(target - p) < 0.0005) p = target;
        draw();
      }
      requestAnimationFrame(loop);
    })();
    introStop = () => { alive = false; autoRun++; clearTimeout(arriveTimer); introStop = null; };
  }

  function demoJump(scene) {
    const team = ($("#f-team") || {}).value?.trim() || "", name = ($("#f-name") || {}).value?.trim() || "";
    if (introStop) introStop();
    S = fresh();
    S.team = team || "데모 조"; S.name = name || "심사위원"; S.start = Date.now(); S.demo = true;
    const idx = STEPS.indexOf(scene);
    C.rooms.forEach((r) => { if (STEPS.indexOf(r.id) < idx) { S.solved[r.id] = true; addItem(r.reward); } });
    if (idx > STEPS.indexOf("act2")) { S.act2.done = true; addItem(C.act2.reward); }
    if (scene === "ending") S.act3Step = 3;
    go(scene);
  }

  /* ═════════ 프롤로그: 길게 눌러 경보 끄기 ═════════ */
  function renderPrologue() {
    const L = C.prologue;
    let n = 1;
    main.innerHTML = `
      <section class="card story alarm" id="pro">
        <div class="siren"><i class="ti ti-alarm" aria-hidden="true"></i> SECURITY LOCKDOWN</div>
        <div id="lines"></div>
        <div class="row" id="pro-act"></div>
      </section>`;
    const draw = () => {
      $("#lines").innerHTML = L.slice(0, n).map((l, i) => beat(l, i === n - 1 ? "fade" : "")).join("");
      const act = $("#pro-act");
      if (n < L.length) {
        act.innerHTML = `<button class="btn primary big" id="b-next">다음</button>`;
        $("#b-next").onclick = () => { n++; draw(); };
      } else {
        act.innerHTML = `<div data-demo="alarm" class="demo-host">${holdBtn('<i class="ti ti-alarm" aria-hidden="true"></i> 길게 눌러 경보 끄기', "big danger")}</div>`;
        longPress($(".hold", act), 1500, () => {
          $("#pro").classList.remove("alarm"); $(".siren").innerHTML = '<i class="ti ti-bell-off" aria-hidden="true"></i> 경보 해제';
          $(".siren").classList.add("off");
          toast(C.alarmOff, "good");
          setTimeout(nextScene, 1200);
        });
        demo($(".demo-host", act), "alarm");
      }
    };
    draw();
  }

  /* ═════════ 단서 나눔: 접속 순서대로 단서를 한 사람씩 맡는다 ═════════
   * 방의 단서 i번은 조원 (i % 인원)번이 본다. 혼자면 모두 본다. 맡은 사람이 나가면 자동으로 다시 나뉜다. */
  function clueOwner(i, offset = 0) {
    if (!online()) return null;
    const m = NET.members();
    if (m.length < 2) return null;
    const who = m[(i + offset) % m.length];
    return who.pid === NET.me.pid ? null : who;
  }
  function clueNote() {
    if (!online() || NET.members().length < 2) return "";
    return `<p class="clue-note">${ic("ti-users")} ${fix("단서가 조원에게 나뉘어 있어요.\n내 단서는 말이나 조 채팅으로 알려 주세요.")}</p>`;
  }
  function bindTheirs() {
    $$("[data-theirs]").forEach((b) => (b.onclick = () => {
      shake(b);
      toast(`이 단서는 <b>${esc(b.dataset.theirs)}님</b> 화면에만 있어요.\n말로 물어보세요!`);
    }));
  }

  /* ═════════ 방 ═════════ */
  function renderRoom(room) {
    const solved = !!S.solved[room.id];
    main.innerHTML = `
      <section class="room">
        <header class="room-head">
          <p class="eyebrow">1막 「70년의 DNA」 · 방 ${room.no} / ${C.rooms.length} · ${room.theme}</p>
          <h2>${room.title}</h2>
          <p>${prose(room.intro)}</p>
        </header>
        ${clueNote()}
        <div class="objects">${room.objects.map((o, i) => {
          const k = room.objects.slice(0, i).filter((x) => !x.shared).length; // 나눠 보는 단서 중 몇 번째인지
          const who = o.shared ? null : clueOwner(k, room.no);
          return who ? `<button class="obj theirs" data-theirs="${esc(who.name)}"><span class="obj-ic">${ic("ti-lock")}</span>${o.label}<small>${esc(who.name)}님 단서</small></button>`
            : `<button class="obj" data-obj="${i}"><span class="obj-ic">${ic(o.icon)}</span>${o.label}${NET && online() && NET.members().length > 1 ? (o.shared ? "<small>모두 보기</small>" : "<small>내 단서</small>") : ""}</button>`;
        }).join("")}</div>
        <div class="card puzzle" id="puzzle"></div>
        <div class="card lockbox" id="lockbox"></div>
      </section>`;
    bindTheirs();
    $$("[data-obj]").forEach((b) => (b.onclick = () => {
      const o = room.objects[+b.dataset.obj];
      if (o.motion === "magnifier") openModal(`${ic(o.icon)} ${o.title}`, "", (body) => magnifier(body, o.body));
      else openModal(`${ic(o.icon)} ${o.title}`, body(o.body));
    }));
    PUZZLES[room.puzzle.type](room, $("#puzzle"));
    if (solved) renderOutro(room);
    else renderLock($("#lockbox"), room.id, room.lock, () => {
      S.solved[room.id] = true; cleared(room.id);
      addItem(room.reward);
      save(); renderHeader();
      if (room.reward) toast(`${ic(room.reward.icon)} <b>${room.reward.label}</b> 획득!`, "good");
      renderOutro(room);
    });
  }

  function renderOutro(room) {
    const box = $("#lockbox");
    // 틀 A 결과 카드: 아이콘 · 제목 · 말풍선 · 버튼이 모두 가운데 한 줄 기준선
    box.innerHTML = `
      <div class="result">
        <div class="result-ic" aria-hidden="true"><i class="ti ti-lock-open" aria-hidden="true"></i></div>
        <h3 class="result-title">문이 열렸어요!</h3>
        ${say(room.outro.who, room.outro.text)}
        <button class="btn primary big" id="b-next">다음 방으로 →</button>
      </div>`;
    box.classList.add("solved");
    $("#b-next").onclick = nextScene;
  }

  /* ═════════ 자물쇠 (입력칸 · 다이얼 · 핀 · 조각) ═════════ */
  function renderLock(box, key, lock, onSolve) {
    const type = lock.type || "text";
    box.innerHTML = `
      <div class="lock">
        <div class="lock-ic"><i class="ti ti-lock" aria-hidden="true"></i></div>
        <p class="lock-label">${body(lock.prompt)}</p>
        <div class="lock-ui" ${type === "dial" ? 'data-demo="dial"' : type === "pins" ? 'data-demo="pins"' : ""}></div>
        <p class="lock-msg" id="lock-msg"></p>
      </div>`;
    const ui = $(".lock-ui", box), msg = $("#lock-msg", box);
    let timer = null;
    const lockedFor = () => Math.ceil(((S.lockUntil[key] || 0) - Date.now()) / 1000);
    const refresh = () => {
      const s = lockedFor();
      if (s > 0) {
        $$("button, input", ui).forEach((x) => { if (!x.disabled) { x.disabled = true; x.dataset.locked = "1"; } });
        msg.innerHTML = fix(`오답이 많아 잠금장치가 잠시 잠겼어요.\n${s}초 뒤에 다시 시도하세요.`);
        msg.className = "lock-msg bad";
        clearTimeout(timer); timer = setTimeout(refresh, 1000);
      } else {
        $$("[data-locked]", ui).forEach((x) => { x.disabled = false; delete x.dataset.locked; });
        if (msg.textContent.includes("잠시 잠겼")) msg.textContent = "";
      }
    };
    // 정답 확인. 맞으면 true
    const tryValue = (v) => {
      if (lockedFor() > 0 || !String(v).trim()) return false;
      if (hash(v) === lock.hash) {
        box.classList.add("unlock");
        onSolve();
        return true;
      }
      S.wrong[key] = (S.wrong[key] || 0) + 1;
      if (S.wrong[key] % C.lockout.tries === 0) S.lockUntil[key] = Date.now() + C.lockout.seconds * 1000;
      save();
      shake($(".lock", box));
      msg.textContent = "철컥… 열리지 않아요. 다시 생각해 보세요.";
      msg.className = "lock-msg bad";
      refresh();
      return false;
    };
    if (type === "dial") dialLock(ui, lock.digits, tryValue);
    else if (type === "pins") pinLock(ui, lock.pins, lock.pick, tryValue);
    else if (type === "pieces") pieceLock(ui, lock, tryValue);
    else {
      ui.innerHTML = `<div class="lock-row">
        <input id="lock-in" autocomplete="off" spellcheck="false" aria-label="${esc(lock.prompt)}" placeholder="${lock.placeholder || ""}">
        <button class="btn primary" id="lock-go">열기</button></div>`;
      const input = $("#lock-in", ui);
      const go = () => { if (!tryValue(input.value)) input.select(); };
      $("#lock-go", ui).onclick = go;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    }
    refresh();
  }

  /* ═════════ 퍼즐 ═════════ */
  const PUZZLES = {
    /* 방 1: 액자 끌어서 걸기 → 뒤집기 */
    timeline(room, el) {
      const P = room.puzzle, N = P.cards.length;
      const st = pz(room.id, () => ({ order: shuffle(P.cards.map((_, i) => i)), slots: Array(N).fill(null), done: false }));
      const draw = () => {
        const onWall = st.slots.filter((x) => x !== null);
        el.innerHTML = `
          <h3><i class="ti ti-photo" aria-hidden="true"></i> 역사 갤러리</h3>
          <p class="help">${prose(P.help)}</p>${P.alt ? `<p class="alt-hint"><i class="ti ti-hand-click" aria-hidden="true"></i>${prose(P.alt)}</p>` : ""}
          <ol class="wall">${st.slots.map((ci, i) => {
            if (ci === null) return `<li class="slot empty ${P.yearSlots ? "year" : ""}" data-slot="${i}"><span>${P.yearSlots ? P.cards[i].year : i + 1}</span></li>`;
            const c = P.cards[ci];
            return `<li class="slot" data-slot="${i}">
              <div class="frame ${st.done ? "flipped" : ""}" ${st.done ? "" : `data-card="${ci}"`}>
                <div class="f-front">${frameInner(c)}</div>
                <div class="f-back"><b>${c.letter}</b><small>${c.year}</small></div>
              </div></li>`;
          }).join("")}</ol>
          ${st.done ? `<p class="done-msg"><i class="ti ti-sparkles" aria-hidden="true"></i> ${prose(P.doneText)}</p>` : `
          <p class="sub-h">바닥에 떨어진 액자</p>
          <div class="floor" data-floor="1" data-demo="frames">${st.order.filter((i) => !onWall.includes(i)).map((i) =>
            `<div class="frame pick" data-card="${i}" tabindex="0" role="button"><div class="f-front">${frameInner(P.cards[i])}</div></div>`).join("")
            || `<p class="note">${body("모든 액자를 걸었어요.\n순서가 맞지 않으면 액자를 끌어 자리를 바꿔 보세요.")}</p>`}</div>`}`;
        if (st.done) return;
        const placeAt = (ci, slot) => {
          const from = st.slots.indexOf(ci);
          if (from >= 0) st.slots[from] = st.slots[slot]; // 다른 칸 액자와 자리 바꾸기
          else if (st.slots[slot] !== null) { /* 바닥에서 온 액자가 찬 칸에 놓이면 원래 액자는 바닥으로 */ }
          st.slots[slot] = ci;
          check(slot);
        };
        dnd(el, {
          item: "[data-card]", zone: "[data-slot], [data-floor]",
          drop: (item, zone) => {
            const ci = +item.dataset.card;
            if (zone.dataset.floor) { const f = st.slots.indexOf(ci); if (f < 0) return "none"; st.slots[f] = null; save(); draw(); return "ok"; }
            placeAt(ci, +zone.dataset.slot); return "ok";
          },
          tap: (item) => {
            const ci = +item.dataset.card, f = st.slots.indexOf(ci);
            if (f >= 0) { st.slots[f] = null; save(); draw(); return; } // 벽의 액자를 누르면 바닥으로
            const empty = st.slots.indexOf(null);
            if (empty >= 0) placeAt(ci, empty);
          }
        });
        $$(".frame.pick", el).forEach((f) => f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f.click(); } }));
      };
      const check = (slot) => {
        save();
        if (st.slots.every((x) => x !== null)) {
          const ok = st.slots.every((ci, i) => P.cards[ci].year === P.cards[i].year);
          if (ok) { st.done = true; save(); draw(); toast("액자를 모두 제자리에 걸었어요!", "good"); return; }
          draw(); shake($(".wall", el));
          toast(P.yearSlots ? "연도가 맞지 않는 액자가 있어요.\n조원 단서로 다시 계산해 보세요." : "순서가 맞지 않아요.\n액자를 끌어서 자리를 바꿔 보세요.", "bad");
          return;
        }
        draw();
        const s = $(`[data-slot="${slot}"]`, el); pop(s);
      };
      draw();
    },

    /* 방 2: 결정 고르기 → 문지르기
     * 틀리면 어느 메모와 어긋나는지 알려 준다 (벌점 없음). 다시 생각하게 하는 게 목적 */
    decision(room, el) {
      const P = room.puzzle;
      const st = pz(room.id, () => ({ pick: null, tried: [], scratched: false }));
      const draw = () => {
        const ok = st.pick === P.answer;
        el.innerHTML = `
          <h3>${ic("ti-git-fork")} ${esc(P.question)}</h3>
          <p class="help">${prose(P.help)}</p>
          <div class="choices">${P.options.map((o) => {
            const bad = (st.tried || []).includes(o.id), win = ok && o.id === P.answer;
            return `<button class="choice ${bad ? "bad" : ""} ${win ? "ok" : ""}" data-pick="${o.id}" ${ok || bad ? "disabled" : ""}>
              <b class="ch-id">${o.id}</b><span>${flow(o.text)}</span>
              ${bad ? `<small>${ic("ti-alert-circle")} 어긋나는 단서: ${esc(o.breaks)}</small>` : ""}
              ${win ? `<small>${ic("ti-check")} 모든 메모를 지켰어요</small>` : ""}</button>`;
          }).join("")}</div>
          ${ok ? `
            <ul class="principles">${P.principles.map((p) => `<li><b>${esc(p.name)}</b><span>${fix(p.why)}</span></li>`).join("")}</ul>
            <p class="done-msg"><i class="ti ti-sparkles" aria-hidden="true"></i> ${prose(P.doneText)}</p>
            <div class="scratch ${st.scratched ? "revealed" : ""}" data-demo="scratch" role="img" aria-label="화이트보드의 지워진 자리: ${P.scratchHidden}">
              <span class="hidden-text">${P.scratchHidden}</span>
              ${st.scratched ? "" : "<canvas></canvas>"}
            </div>` : ""}`;
        $$("[data-pick]", el).forEach((b) => (b.onclick = () => {
          const id = b.dataset.pick, o = P.options.find((x) => x.id === id);
          if (id === P.answer) { st.pick = id; save(); draw(); toast("모든 부서의 메모를 지키는 결정이에요!", "good"); return; }
          st.tried = (st.tried || []).concat(id); save(); draw();
          shake($(`[data-pick="${id}"]`, el));
          toast(`이 결정은 <b>${esc(o.breaks)}</b>에 어긋나요.\n그 단서를 가진 조원에게 다시 물어보세요.`, "bad");
        }));
        if (ok && !st.scratched) {
          const sb = $(".scratch", el);
          scratch(sb, () => { st.scratched = true; save(); setTimeout(draw, 600); });
          demo(sb, "scratch");
        }
      };
      draw();
    },

    /* 방 3: 장바구니에 담기 */
    shelf(room, el) {
      const P = room.puzzle;
      const st = pz(room.id, () => ({ basket: [] }));
      const draw = () => {
        el.innerHTML = `
          <h3><i class="ti ti-shopping-cart" aria-hidden="true"></i> 식료품 선반</h3>
          <p class="help">${prose(P.help)}</p>${P.alt ? `<p class="alt-hint"><i class="ti ti-hand-click" aria-hidden="true"></i>${prose(P.alt)}</p>` : ""}
          <div class="kitchen">
            <div class="shelf">${P.items.map((it, i) => `
              <div class="product ${st.basket.includes(it.slot) ? "taken" : ""}" data-p="${i}" tabindex="0" role="button" aria-label="${it.slot}번 칸 ${it.name}">
                <img src="${it.img}" alt="${it.name}" loading="lazy">
                <span class="slotno">${it.slot}</span>
                <span class="tip">${it.name}</span>
              </div>`).join("")}</div>
            <div class="basket" data-basket="1" data-demo="basket">
              <div class="b-icon"><i class="ti ti-basket" aria-hidden="true"></i></div>
              <p class="b-title">장바구니</p>
              <ol class="b-list">${Array.from({ length: P.basketSize }, (_, k) => {
                const s = st.basket[k];
                const it = P.items.find((x) => x.slot === s);
                return s ? `<li class="b-item"><span class="b-no">${s}</span>${it.name}<button class="x" data-out="${k}" aria-label="${it.name} 빼기"><i class="ti ti-x" aria-hidden="true"></i></button></li>`
                  : `<li class="b-empty">${k + 1}번째 재료</li>`;
              }).join("")}</ol>
              <p class="b-code">칸 번호: <b>${st.basket.join(" ") || "—"}</b></p>
            </div>
          </div>`;
        dnd(el, {
          item: "[data-p]:not(.taken)", zone: "[data-basket]",
          drop: (item) => add(+item.dataset.p),
          tap: (item) => info(+item.dataset.p)
        });
        $$("[data-p].taken", el).forEach((p) => (p.onclick = () => info(+p.dataset.p)));
        $$("[data-p]", el).forEach((p) => p.addEventListener("keydown", (e) => { if (e.key === "Enter") info(+p.dataset.p); }));
        $$("[data-out]", el).forEach((b) => (b.onclick = () => { st.basket.splice(+b.dataset.out, 1); save(); draw(); }));
      };
      const add = (i) => {
        const it = P.items[i];
        if (st.basket.includes(it.slot)) return "none";
        if (st.basket.length >= P.basketSize) { toast("바구니가 가득 찼어요.\n빼고 싶은 재료의 ✕를 누르세요.", "bad"); return "bad"; }
        st.basket.push(it.slot); save(); draw(); pop($(".basket", el));
        return "ok";
      };
      const info = (i) => {
        const it = P.items[i];
        openModal(`${it.slot}번 칸 · ${it.name}`, `<img class="modal-img" src="${it.img}" alt="${it.name}"><p>${prose(it.info)}</p>
          <div class="row"><button class="btn primary" id="to-basket" ${st.basket.includes(it.slot) ? "disabled" : ""}><i class="ti ti-basket" aria-hidden="true"></i> 바구니에 담기</button></div>`,
        (b) => { $("#to-basket", b).onclick = () => { closeModal(); add(i); }; });
      };
      draw();
    },

    /* 방 4: 탱크 메모판. 균주와 정상/문제를 조원이 함께 표시한다 (정답 판정은 자물쇠에서)
     * 값은 st.s5, st.v5처럼 탱크마다 따로 둬서 두 사람이 동시에 눌러도 서로 덮어쓰지 않는다 */
    tanklog(room, el) {
      const P = room.puzzle;
      const st = pz(room.id, () => ({}));
      const no = (n) => String.fromCharCode(0x2460 + n - 1);
      const draw = () => {
        el.innerHTML = `
          <h3>${ic("ti-test-pipe")} 발효 탱크 점검판</h3>
          <p class="help">${prose(P.help)}</p>
          <div class="tlog">${P.tanks.map((n) => {
            const s = st["s" + n], v = st["v" + n];
            return `<div class="tl ${v || ""}">
              <span class="tl-no">${no(n)}</span>
              <span class="tl-tank" aria-hidden="true"><i></i></span>
              <p class="tl-cap">무엇을 만드나요?</p>
              <div class="tl-row">${P.strains.map((x) => `<button class="chip ${s === x ? "on" : ""}" data-strain="${n}" data-x="${esc(x)}" aria-pressed="${s === x}">${esc(x)}</button>`).join("")}</div>
              <p class="tl-cap">기준 안인가요?</p>
              <div class="tl-row">
                <button class="chip ${v === "ok" ? "on" : ""}" data-v="${n}" data-x="ok" aria-pressed="${v === "ok"}">${ic("ti-check")} 정상</button>
                <button class="chip warn ${v === "bad" ? "on" : ""}" data-v="${n}" data-x="bad" aria-pressed="${v === "bad"}">${ic("ti-alert-triangle")} 문제</button>
              </div>
            </div>`;
          }).join("")}</div>
          <p class="note">${prose(P.note)}</p>`;
        const toggle = (key, x) => { st[key] = st[key] === x ? null : x; save(); draw(); };
        $$("[data-strain]", el).forEach((b) => (b.onclick = () => toggle("s" + b.dataset.strain, b.dataset.x)));
        $$("[data-v]", el).forEach((b) => (b.onclick = () => toggle("v" + b.dataset.v, b.dataset.x)));
      };
      draw();
    },

    /* 방 5: 일정표. 칸을 눌러 ○ → ✕ → 빈칸. 네 줄이 모두 ○인 열은 강조 */
    schedule(room, el) {
      const P = room.puzzle;
      const st = pz(room.id, () => ({}));
      const times = [];
      for (let t = P.start; t < P.end; t += 0.5) times.push(t);
      const lab = (t) => `${Math.floor(t)}:${t % 1 ? "30" : "00"}`;
      const draw = () => {
        const allOk = times.map((_, c) => P.rows.every((_, r) => st[`c${r}_${c}`] === "o"));
        el.innerHTML = `
          <h3>${ic("ti-calendar-time")} 오늘 오후 일정 맞추기</h3>
          <p class="help">${prose(P.help)}</p>
          <div class="sched-wrap"><table class="sched">
            <thead><tr><th scope="col"></th>${times.map((t, c) => `<th scope="col" class="${allOk[c] ? "all" : ""}">${lab(t)}</th>`).join("")}</tr></thead>
            <tbody>${P.rows.map((name, r) => `<tr><th scope="row">${esc(name)}</th>${times.map((t, c) => {
              const v = st[`c${r}_${c}`];
              return `<td class="${allOk[c] ? "all" : ""}"><button class="cell ${v || ""}" data-cell="${r}_${c}" aria-label="${esc(name)} ${lab(t)} ${v === "o" ? "가능" : v === "x" ? "안 됨" : "모름"}">${v === "o" ? "○" : v === "x" ? "✕" : ""}</button></td>`;
            }).join("")}</tr>`).join("")}</tbody>
          </table></div>
          <p class="note">${allOk.some(Boolean) ? body("모두 ○인 칸이 생겼어요.\n그 칸의 시작 시각을 다이얼에 넣어 보세요.") : body("○ 가능 · ✕ 안 됨\n한 칸은 30분이에요.")}</p>`;
        $$("[data-cell]", el).forEach((b) => (b.onclick = () => {
          const k = "c" + b.dataset.cell, v = st[k];
          st[k] = v === "o" ? "x" : v === "x" ? null : "o";
          save(); draw();
        }));
      };
      draw();
    }
  };

  function frameInner(c) {
    const pic = c.img ? `<img src="${c.img}" alt="" loading="lazy" draggable="false">` : `<span class="emoji">${ic(c.emoji || "ti-building-factory-2")}</span>`;
    return `<span class="pic">${pic}</span><span class="cap">${flow(c.text)}</span>`;
  }

  /* ═════════ 2막: 손전등 + 길게 눌러 지목 ═════════ */
  function renderAct2() {
    const A = C.act2, st = S.act2;
    if (st.done) return renderTwist();
    const allQ = true; // 확인 질문 없이 바로 추리
    // 조원 투표: 지금 접속한 조원의 과반이 같은 사람을 고르면 확정
    const team = online() && NET.members().length > 1;
    const members = online() ? NET.members() : [];
    const myId = online() ? NET.me.pid : "me";
    const votes = st.votes || {};
    const need = team ? Math.floor(members.length / 2) + 1 : 1;
    // 출입 기록은 마지막에 들어온 조원, 출입증 목록은 첫 조원이 본다 (2명 이상이면 서로 다른 사람)
    const eviOwner = clueOwner(0, members.length - 1), badgeOwner = clueOwner(1, members.length - 1);
    main.innerHTML = `
      <section class="room">
        <header class="room-head">
          <p class="eyebrow">2막 · 증언 추리</p>
          <h2>${A.title}</h2>
          <p>${prose(A.intro)}</p>
          ${A.introSay ? say(A.introSay.who, A.introSay.text) : ""}
        </header>
        ${clueNote()}
        <div class="objects">${eviOwner ? `<button class="obj theirs" data-theirs="${esc(eviOwner.name)}"><span class="obj-ic">${ic("ti-lock")}</span>${A.evidence.label}<small>${esc(eviOwner.name)}님 단서</small></button>`
          : `<button class="obj" id="evi"><span class="obj-ic">${ic(A.evidence.icon)}</span>${A.evidence.label}</button>`}
          ${badgeOwner ? `<button class="obj theirs" data-theirs="${esc(badgeOwner.name)}"><span class="obj-ic">${ic("ti-lock")}</span>${A.badges.label}<small>${esc(badgeOwner.name)}님 단서</small></button>`
          : `<button class="obj" id="badges"><span class="obj-ic">${ic(A.badges.icon)}</span>${A.badges.label}</button>`}</div>
        ${allQ && team ? `<p class="vote-note">${ic("ti-checkbox")} ${fix(`조원 ${need}명 이상이 같은 사람을 지목해야 확정돼요.\n다시 누르면 내 표를 옮길 수 있어요.`)}</p>` : ""}
        <div class="suspects" ${allQ ? 'data-demo="accuse"' : ""}>${A.suspects.map((s, i) => {
          const voters = members.filter((m) => votes[m.pid] === i);
          return `
          <article class="suspect ${votes[myId] === i ? "voted" : ""}">
            <div class="s-head"><span class="s-emoji">${ic(s.emoji)}</span><div><b>${s.name}</b><small>${s.dept}</small></div></div>
            <p>${flow(s.testimony)}</p>
            ${team && voters.length ? `<p class="votes">${ic("ti-hand-finger")} ${voters.map((m) => esc(m.name)).join(", ")} <b>${voters.length}/${need}</b></p>` : ""}
            ${allQ ? holdBtn(`<i class="ti ti-hand-finger" aria-hidden="true"></i> ${team ? "길게 눌러 투표" : "길게 눌러 지목"}`, "small accuse").replace("<button", `<button data-accuse="${i}"`) : ""}
          </article>`;
        }).join("")}</div>
      </section>`;
    bindTheirs();
    if ($("#evi")) $("#evi").onclick = () => openModal(`${ic(A.evidence.icon)} ${A.evidence.title}`, "", (body) =>
      flashlight(body, `<table class="tbl log"><tr><th>시각</th><th>기록</th><th>출입증</th></tr>${A.evidence.rows.map((r) =>
        `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table>`, A.evidence.note));
    if ($("#badges")) $("#badges").onclick = () => openModal(`${ic(A.badges.icon)} ${A.badges.title}`, body(A.badges.body));
    $$("[data-accuse]").forEach((b) => longPress(b, 2000, () => {
      const i = +b.dataset.accuse;
      if (team) {
        st.votes = Object.assign({}, st.votes, { [myId]: i });
        const count = members.filter((m) => st.votes[m.pid] === i).length;
        if (count < need) {
          save(); renderAct2();
          toast(`${esc(A.suspects[i].name)}에게 투표했어요. (${count}/${need})\n조원과 의견을 맞춰 보세요.`);
          return;
        }
        st.votes = {}; // 확정되면 표를 비운다 (틀리면 다시 투표)
      }
      if (i === A.culprit) {
        st.done = true; st.twist = 1; addItem(A.reward); S.solved.act2 = true; cleared("act2"); save();
        toast(`${ic(A.reward.icon)} <b>${A.reward.label}</b> 획득!`, "good");
        renderHeader(); renderTwist();
      } else {
        S.penalty += 60; save(); tick();
        b.classList.add("broken"); setTimeout(() => { b.classList.remove("broken"); b.style.setProperty("--p", 0); }, 700);
        shake(b.closest(".suspect")); toast(A.wrongText, "bad", 3500);
        if (team) setTimeout(renderAct2, 800);
      }
    }));
  }

  function renderTwist() {
    const A = C.act2, st = S.act2;
    const n = Math.max(1, st.twist);
    main.innerHTML = `
      <section class="card story">
        <p class="eyebrow">2막 · 진실</p>
        <h2>레시피북을 꺼낸 사람은… 한햇님!</h2>
        <div id="lines">${A.twist.slice(0, n).map((l, i) => beat(l, i === n - 1 ? "fade" : "")).join("")}</div>
        <div class="row"><button class="btn primary big" id="b-next">${n < A.twist.length ? "다음" : "타임캡슐로 가기 →"}</button></div>
      </section>`;
    $("#b-next").onclick = () => {
      if (n < A.twist.length) { st.twist = n + 1; save(); renderTwist(); }
      else nextScene();
    };
  }

  /* ═════════ 3막 ═════════ */
  /* 접속 순서대로 역할 자동 배정: 1번째 A, 2번째 B, 3번째 C.
   * 2명이면 1번째가 A·C, 1명이면 모두. 4번째부터는 '기록 담당' (단서 없음, 조원 설명을 정리) */
  function teamRoles() {
    const m = NET.members(), keys = Object.keys(C.act3.roles);
    const of = (k) => keys.filter((_, j) => j % m.length === k);
    return { members: m, mine: of(NET.myIndex()), of, keys };
  }
  function renderAct3() {
    const T = C.act3;
    if (online()) { S.role = "team"; return renderAct3Team(); }
    if (!S.role || S.role === "team") return renderRoles();
    if (S.act3Step >= T.locks.length) return go("ending");
    const lock = T.locks[S.act3Step];
    const tab = S.role === "solo" ? (S.puzzle.act3tab || "A") : S.role;
    const r = T.roles;
    main.innerHTML = `
      <section class="room">
        <header class="room-head">
          <p class="eyebrow">3막 · 팀 협동 · 잠금장치 ${S.act3Step + 1} / ${T.locks.length}</p>
          <h2>${T.title}</h2>
          <div class="capsule-steps">${T.locks.map((l, i) => `<span class="${i < S.act3Step ? "done" : i === S.act3Step ? "now" : ""}">${i < S.act3Step ? '<i class="ti ti-lock-open" aria-hidden="true"></i>' : '<i class="ti ti-lock" aria-hidden="true"></i>'}</span>`).join("")}</div>
        </header>
        <div class="role-bar">
          ${S.role === "solo" ? `<span>${'<i class="ti ti-user" aria-hidden="true"></i> ' + body("혼자 하기: 세 역할의 단서를 모두 볼 수 있어요")}</span>` :
            `<span class="role-badge" style="--c:${r[S.role].color}">${ic(r[S.role].emoji)} 내 역할: ${r[S.role].name}</span>
             <span class="note">다른 단서는 조원에게 물어보세요!</span>`}
          <button class="btn small" id="b-role">역할 바꾸기</button>
        </div>
        <div class="card">
          <h3>${lock.title}</h3>
          ${S.role === "solo" ? `<div class="tabs">${["A", "B", "C"].map((k) =>
            `<button class="tab ${tab === k ? "on" : ""}" data-tab="${k}" style="--c:${r[k].color}">${ic(r[k].emoji)} ${r[k].name}</button>`).join("")}</div>` : ""}
          <div class="clue" style="--c:${r[tab].color}">${body(lock.clues[tab])}</div>
        </div>
        <div class="card lockbox" id="lockbox"></div>
      </section>`;
    $("#b-role").onclick = () => { S.role = null; save(); renderAct3(); };
    $$("[data-tab]").forEach((b) => (b.onclick = () => { S.puzzle.act3tab = b.dataset.tab; save(); renderAct3(); }));
    renderLock($("#lockbox"), "act3-" + S.act3Step, lock, () => {
      S.solved["act3-" + S.act3Step] = true; cleared("act3-" + S.act3Step);
      toast(lock.solvedText, "good");
      S.act3Step++;
      S.puzzle.act3tab = "A"; // 다음 잠금장치는 항상 첫 역할(라이프스타일 식품) 단서부터 보여 준다
      save();
      setTimeout(() => { if (S.act3Step >= T.locks.length) go("ending"); else { renderAct3(); renderHeader(); runDemos(); } }, 700);
    });
  }

  function renderAct3Team() {
    const T = C.act3, r = T.roles;
    if (S.act3Step >= T.locks.length) return go("ending");
    const lock = T.locks[S.act3Step];
    const R = teamRoles(), mine = R.mine;
    const tab = mine.includes(S.tab) ? S.tab : mine[0];
    const roster = R.members.map((m, k) => {
      const ks = R.of(k);
      return `<li class="${m.pid === NET.me.pid ? "me" : ""}">${ks.length ? ks.map((x) => `<span class="role-dot" style="--c:${r[x].color}">${x}</span>`).join("") : `<span class="role-dot rec">${ic("ti-pencil")}</span>`}
        <b>${esc(m.name)}</b>${m.pid === NET.me.pid ? "<small>나</small>" : ""}</li>`;
    }).join("");
    main.innerHTML = `
      <section class="room">
        <header class="room-head">
          <p class="eyebrow">3막 · 팀 협동 · 잠금장치 ${S.act3Step + 1} / ${T.locks.length}</p>
          <h2>${T.title}</h2>
          <div class="capsule-steps">${T.locks.map((l, i) => `<span class="${i < S.act3Step ? "done" : i === S.act3Step ? "now" : ""}">${i < S.act3Step ? '<i class="ti ti-lock-open" aria-hidden="true"></i>' : '<i class="ti ti-lock" aria-hidden="true"></i>'}</span>`).join("")}</div>
        </header>
        <div class="role-bar">
          ${mine.length ? mine.map((k) => `<span class="role-badge" style="--c:${r[k].color}">${ic(r[k].emoji)} ${r[k].name}</span>`).join("")
            : `<span class="role-badge rec">${ic("ti-pencil")} 기록 담당</span>`}
          <span class="note">${R.members.length === 1 ? "혼자 접속 중이라 모든 단서가 보여요." : mine.length ? "다른 단서는 조원에게 물어보세요!" : "조원들의 설명을 듣고 정리해 주세요."}</span>
        </div>
        <ul class="roster">${roster}</ul>
        <div class="card">
          <h3>${lock.title}</h3>
          ${mine.length > 1 ? `<div class="tabs">${mine.map((k) =>
            `<button class="tab ${tab === k ? "on" : ""}" data-tab="${k}" style="--c:${r[k].color}">${ic(r[k].emoji)} ${r[k].name}</button>`).join("")}</div>` : ""}
          ${tab ? `<div class="clue" style="--c:${r[tab].color}">${body(lock.clues[tab])}</div>`
            : `<div class="clue rec">${body("기록 담당은 단서가 없어요.\n세 사람이 말하는 단서를 아래 메모장에 정리하고,\n정답을 맞춰 보세요.")}<textarea class="memo-pad" id="memo" rows="4" placeholder="예: A가 본 순서 → 햇반, 비비고 …">${esc(S.memo || "")}</textarea></div>`}
        </div>
        <div class="card lockbox" id="lockbox"></div>
      </section>`;
    $$("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; save(); renderAct3Team(); }));
    const memo = $("#memo"); if (memo) memo.oninput = () => { S.memo = memo.value; save(); };
    renderLock($("#lockbox"), "act3-" + S.act3Step, lock, () => {
      S.solved["act3-" + S.act3Step] = true; cleared("act3-" + S.act3Step);
      toast(lock.solvedText, "good");
      S.act3Step++;
      S.tab = null;
      save();
      setTimeout(() => { if (S.act3Step >= T.locks.length) go("ending"); else { renderAct3(); renderHeader(); runDemos(); } }, 700);
    });
  }

  function renderRoles() {
    const T = C.act3, r = T.roles;
    main.innerHTML = `
      <section class="room">
        <header class="room-head">
          <p class="eyebrow">3막 · 팀 협동</p>
          <h2>${T.title}</h2>
          <p>${prose(T.intro)}</p>
        </header>
        <div class="roles">${Object.keys(r).map((k) => `
          <button class="role" data-role="${k}" style="--c:${r[k].color}">
            <span class="r-emoji">${ic(r[k].emoji)}</span><b>${k}. ${r[k].name}</b><small>${fix("이 부문의 단서만\n볼 수 있어요")}</small>
          </button>`).join("")}
          <button class="role solo" data-role="solo"><span class="r-emoji"><i class="ti ti-user" aria-hidden="true"></i></span><b>혼자 하기</b><small>${fix("세 역할의 단서를 모두 봐요\n(자습·데모용)")}</small></button>
        </div>
        <p class="note center">${fix("조원 세 명이 각자 기기에서\n서로 다른 역할을 고르세요.\n정답은 누구의 기기에 입력해도 돼요.")}</p>
      </section>`;
    $$("[data-role]").forEach((b) => (b.onclick = async () => {
      S.role = b.dataset.role; save();
      if (S.role !== "solo") await guideOnce("roleRule", [G.roleRule], { warn: true, strict: true });
      renderAct3(); renderHeader(); runDemos();
    }));
  }

  /* ═════════ 엔딩: 밀어서 열기 → 책장 넘기기 → 편지 넣기 ═════════ */
  function renderEnding() {
    const E = C.ending;
    if (!S.end) { S.end = Date.now(); save(); }
    const stage = S.endingStage;
    const nextStage = () => { S.endingStage++; save(); renderEnding(); setTimeout(runDemos, 300); };

    if (stage === 0) {
      main.innerHTML = `<section class="card story ending">
        <div class="capsule"><i class="ti ti-lock-open" aria-hidden="true"></i></div>
        <p class="line fade">${fix(E.capsule)}</p>
        <div class="slide-wrap"></div></section>`;
      slideOpen($(".slide-wrap"), E.slideLabel, () => {
        $(".capsule").classList.add("open");
        setTimeout(nextStage, REDUCED ? 100 : 1100);
      });
    } else if (stage === 1) {
      let p = S.puzzle.page || 0;
      const draw = (dir) => {
        const pg = E.pages[p];
        main.innerHTML = `<section class="story ending">
          <p class="eyebrow center">ONLYONE RECIPE BOOK · 1953 – 2026</p>
          <div class="book">
            <article class="page ${dir ? "turn-" + dir : ""} ${pg.last ? "last" : ""}">
              <p class="p-year">${pg.year}</p>
              <h3>${fix(pg.title)}</h3>
              <p class="p-lines">${lines(pg.lines)}</p>
              <span class="p-no">${p + 1} / ${E.pages.length}</span>
              ${pg.last ? "" : `<span class="p-corner" aria-hidden="true"></span>`}
            </article>
          </div>
          <p class="note center">${fix(pg.last ? "" : "책장 모서리를 왼쪽으로 끌거나\n▶ 버튼을 눌러 넘기세요.")}</p>
          <div class="row">
            <button class="btn" id="pg-prev" ${p === 0 ? "disabled" : ""}>◀ 이전</button>
            ${pg.last ? `<button class="btn primary" id="pg-done">선배들의 메시지 보기</button>` : `<button class="btn primary" id="pg-next">다음 장 ▶</button>`}
          </div></section>`;
        const turn = (d) => { p = Math.max(0, Math.min(E.pages.length - 1, p + d)); S.puzzle.page = p; save(); draw(d > 0 ? "next" : "prev"); };
        $("#pg-prev").onclick = () => turn(-1);
        const nx = $("#pg-next"); if (nx) nx.onclick = () => turn(1);
        const dn = $("#pg-done"); if (dn) dn.onclick = nextStage;
        // 페이지 넘기기: 왼쪽으로 끌거나 스와이프
        const page = $(".page");
        page.addEventListener("pointerdown", (e) => {
          const x0 = e.clientX;
          capture(page, e);
          const mv = (ev) => { const dx = Math.min(0, ev.clientX - x0); page.style.transform = `perspective(900px) rotateY(${Math.max(-40, dx / 6)}deg)`; };
          const upf = (ev) => {
            page.removeEventListener("pointermove", mv); page.removeEventListener("pointerup", upf);
            const dx = ev.clientX - x0;
            page.style.transform = "";
            if (dx < -60 && !E.pages[p].last) turn(1);
            else if (dx > 60 && p > 0) turn(-1);
          };
          page.addEventListener("pointermove", mv);
          page.addEventListener("pointerup", upf);
        });
      };
      draw();
    } else if (stage === 2) {
      main.innerHTML = `<section class="room">
        <header class="room-head"><p class="eyebrow">타임캡슐 속 편지</p><h2>${fix("먼저 입사한 선배들이\n남긴 메시지")}</h2>
        <p class="note">※ 포트폴리오용으로 지어낸 가상 인물의 메시지예요.</p></header>
        <div class="letters">${E.seniors.map((s) => `
          <article class="letter"><div class="s-head"><span class="s-emoji">${s.emoji ? ic(s.emoji) : initial(s.name)}</span><div><b>${s.name}</b><small>${s.role}</small></div></div>
          <p>${body(s.msg)}</p></article>`).join("")}</div>
        <div class="row"><button class="btn primary big" id="b-next">나도 메시지 남기기</button></div></section>`;
      $("#b-next").onclick = nextStage;
    } else if (stage === 3) {
      main.innerHTML = `<section class="card story ending">
        <h2><i class="ti ti-pencil" aria-hidden="true"></i> 100주년에게 보내는 편지</h2>
        <p>${fix(E.letterPrompt)}</p>
        <textarea id="letter" maxlength="80" rows="3" placeholder="예: 세계 모든 식탁에서 K-Food를 만나고 있기를!">${esc(S.letter)}</textarea>
        <p class="note"><span id="cnt">${S.letter.length}</span> / 80자</p>
        <div class="post">
          <div class="envelope" data-env="1" tabindex="0" role="button" aria-label="편지를 캡슐에 넣기"><i class="ti ti-mail" aria-hidden="true"></i><small>내 편지</small></div>
          <span class="arrow">→</span>
          <div class="capsule-zone" data-capzone="1" data-demo="drop"><i class="ti ti-archive" aria-hidden="true"></i><small>타임캡슐</small></div>
        </div>
        <p class="note">${fix(E.letterDrop)}</p></section>`;
      const ta = $("#letter");
      ta.addEventListener("input", () => { $("#cnt").textContent = ta.value.length; S.letter = ta.value; save(); });
      const send = () => {
        const v = ta.value.trim();
        if (!v) { shake(ta); ta.focus(); toast("편지를 먼저 써 주세요."); return "bad"; }
        S.letter = v; save();
        if (online() && !S.letterSent) { S.letterSent = true; save(); NET.post("letter", v).catch(() => { S.letterSent = false; save(); }); }
        $(".capsule-zone").classList.add("sealed");
        setTimeout(nextStage, REDUCED ? 100 : 900);
        return "ok";
      };
      dnd($(".post"), { item: "[data-env]", zone: "[data-capzone]", drop: () => send(), tap: () => send() });
      $(".envelope").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    } else renderCert();
  }

  function renderCert() {
    main.innerHTML = `
      <section class="card story ending">
        <h2><i class="ti ti-confetti" aria-hidden="true"></i> 탈출 성공!</h2>
        <div class="stats">
          <div><small>최종 기록</small><b>${fmt(elapsed())}</b></div>
          <div><small>힌트 사용</small><b>${S.hintsUsed}회</b></div>
          <div><small>벌점 시간</small><b>${fmt(S.penalty)}</b></div>
          ${online() ? `<div><small>첫 탈출 메달</small><b>${NET.firstsOf(NET.team.id)}개</b></div>` : ""}
        </div>
        <canvas id="cert" width="1200" height="850" aria-label="수료증"></canvas>
        <div class="row">
          <button class="btn primary big" id="b-dl">수료증 이미지 저장</button>
          <button class="btn big" id="b-again">처음부터 다시</button>
        </div>
      </section>`;
    drawCert($("#cert"));
    if (online()) {
      $(".card.story.ending").insertAdjacentHTML("afterend", `
        <section class="card wall-card"><h2>${ic("ti-trophy")} 조별 기록</h2><div id="end-board"></div></section>
        <section class="card wall-card"><h2>${ic("ti-mail-opened")} 100주년에게 보내는 메시지 벽</h2>
          <p class="note">${fix("이번 회차 모든 참가자의 편지가 모여요.")}</p><div class="letter-wall" id="end-wall"></div></section>`);
      drawEndBoards();
    }
    $("#b-dl").onclick = () => {
      const a = document.createElement("a");
      a.download = `ONLYONE_수료증_${S.name}.png`;
      a.href = $("#cert").toDataURL("image/png");
      a.click();
    };
    $("#b-again").onclick = askRestart;
  }

  function drawCert(cv) {
    const x = cv.getContext("2d"), W = cv.width, H = cv.height;
    const font = getComputedStyle(document.body).fontFamily;
    const tfont = getComputedStyle(document.documentElement).getPropertyValue("--font-title").trim() || font; // 수료증 제목은 CJ 제목 서체
    x.fillStyle = "#FFFDF8"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#E8392B"; x.lineWidth = 10; x.strokeRect(30, 30, W - 60, H - 60);
    x.strokeStyle = "#F39200"; x.lineWidth = 3; x.strokeRect(52, 52, W - 104, H - 104);
    const petal = (cx, cy, r, color, rot) => {
      x.save(); x.translate(cx, cy); x.rotate(rot); x.fillStyle = color;
      x.beginPath(); x.ellipse(0, -r, r * 0.55, r, 0, 0, Math.PI * 2); x.fill(); x.restore();
    };
    petal(W / 2 - 22, 130, 26, "#E8392B", -0.6);
    petal(W / 2, 118, 26, "#F39200", 0);
    petal(W / 2 + 22, 130, 26, "#FFC20E", 0.6);
    x.textAlign = "center"; x.fillStyle = "#222";
    x.font = `700 22px ${font}`; x.fillText("CJ제일제당 신입 온보딩 방탈출", W / 2, 205);
    x.font = `800 60px ${tfont}`; x.fillText(C.ending.certTitle, W / 2, 285);
    x.font = `700 40px ${tfont}`; x.fillStyle = "#C8281C"; x.fillText(`${S.team} · ${S.name}님`, W / 2, 370);
    x.fillStyle = "#333"; x.font = `400 24px ${font}`;
    x.fillText("위 사람은 70년의 DNA를 탐험하고, 사라진 레시피북의 진실을 밝혀,", W / 2, 435);
    x.fillText("세 사업부문과 함께 햇반 30주년 타임캡슐을 열었기에 이 증서를 드립니다.", W / 2, 472);
    x.font = `700 26px ${font}`; x.fillStyle = "#222";
    x.fillText(`기록 ${fmt(elapsed())}  ·  힌트 ${S.hintsUsed}회`, W / 2, 540);
    x.fillStyle = "#FFF3E0"; x.fillRect(150, 580, W - 300, 130);
    x.fillStyle = "#F39200"; x.font = `700 20px ${font}`; x.fillText("To. 2053년 창립 100주년의 CJ제일제당", W / 2, 615);
    x.fillStyle = "#333"; x.font = `500 26px ${font}`;
    wrapText(x, `"${S.letter}"`, W / 2, 660, W - 360, 34);
    const d = new Date(S.end || Date.now());
    x.font = `400 18px ${font}`; x.fillStyle = "#777";
    x.fillText(`${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.${S.demo ? "  (데모 플레이)" : ""}`, W / 2, 765);
    x.font = `400 14px ${font}`; x.fillText("비공식 포트폴리오 · 지원자 제작", W / 2, 790);
  }
  // 수료증 편지: 띄어쓰기 단위로 줄바꿈
  function wrapText(x, text, cx, y, maxW, lh) {
    const words = text.split(" ");
    const out = []; let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
    out.slice(0, 2).forEach((l, i) => x.fillText(l, cx, y + i * lh));
  }

  /* ═════════════════════════════════════════
   *  소통: 우리 조 채팅 · 전체 채팅 · 조별 현황
   * ═════════════════════════════════════════ */
  let chatTab = "team", chatOpen = false, chatReady = false;
  const unread = { team: 0, all: 0 };
  const tabOf = (m) => (m.scope === "team" ? "team" : m.scope === "letter" ? null : "all");
  const hhmm = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  // 받침에 따라 조사 고르기: josa("비비고 조", "이", "가") → "비비고 조가"
  function josa(word, withBatchim, without) {
    const w = String(word || "").replace(/[\s」』)\]】.!?]+$/, "");
    const c = w.charCodeAt(w.length - 1);
    if (c >= 0xAC00 && c <= 0xD7A3) return word + ((c - 0xAC00) % 28 ? withBatchim : without);
    if (/[0-9]$/.test(w)) return word + ("013678".includes(w.slice(-1)) ? withBatchim : without);
    return word + without;
  }
  function keyLabel(key) {
    if (!key) return "";
    if (key.startsWith("room")) { const r = C.rooms.find((x) => x.id === key); return r ? `방 ${r.no} ${r.title.replace(/「.*」/, "").trim()}` : key; }
    if (key === "act2") return "2막 추리";
    const l = C.act3.locks[+key.split("-")[1]]; return l ? l.title : key;
  }

  function renderTeamBar() {
    const bar = $("#teambar");
    if (!bar) return;
    if (!online() || S.scene === "start") { bar.hidden = true; return; }
    const m = NET.members();
    bar.hidden = false;
    bar.innerHTML = `<b>${esc(NET.team.name)}</b><span class="tb-people" title="${esc(m.map((p) => p.name).join(", "))}">${m.slice(0, 5).map((p) =>
      `<span class="av ${p.pid === NET.me.pid ? "me" : ""}" aria-hidden="true">${esc(p.name.trim().charAt(0))}</span>`).join("")}<small>${m.length}명 접속</small></span>`;
  }

  // 지점마다 '가장 먼저 연 조'가 새로 나오면 모두에게 알림
  let firstsSeen = null;
  function watchFirsts() {
    const f = NET.firsts();
    if (firstsSeen === null) { firstsSeen = new Set(Object.keys(f)); return; }
    Object.keys(f).forEach((k) => {
      if (firstsSeen.has(k)) return;
      firstsSeen.add(k);
      const t = NET.teams[f[k].team];
      const us = f[k].team === NET.team.id;
      toast(`${ic("ti-medal")} <b>${esc(josa(t ? t.name : "", "이", "가"))}</b> ${esc(josa(keyLabel(k), "을", "를"))} 가장 먼저 열었어요!${us ? "\n첫 탈출 메달 획득!" : ""}`, us ? "good" : "", 4500);
    });
  }

  function chatInit() {
    if (!online()) return;
    $("#chat-fab").hidden = false;
    renderTeamBar();
    if (chatReady) { drawChat(); return; }
    chatReady = true;
    firstsSeen = null; watchFirsts();
    NET.on("message", (m, updated) => {
      if (!online() || S.scene === "start") return;
      const mine = m.team_id === NET.team.id;
      if (updated) { drawChat(); return; }
      if (m.scope === "team" && !mine) return;
      if (m.scope === "letter") { drawEndBoards(); return; }
      const fromMe = m.meta && m.meta.pid === NET.me.pid;
      if (m.scope === "notice") toast(`${ic("ti-speakerphone")} <b>진행자</b> ${esc(m.body)}`, "notice", 7000);
      const tab = tabOf(m);
      if (tab && !fromMe && !(chatOpen && chatTab === tab)) unread[tab]++;
      drawChat();
    });
    NET.on("teams", () => { if (!online() || S.scene === "start") return; watchFirsts(); tick(); if (chatOpen && chatTab === "board") drawChat(); drawEndBoards(); });
    NET.on("presence", () => { if (chatOpen && chatTab === "board") drawChat(); });
    NET.on("status", (s) => { if (s === "SAVE_ERROR") toast("저장이 잠깐 안 됐어요.\n인터넷 연결을 확인해 주세요.", "bad"); });
    $("#chat-fab").onclick = () => toggleChat(!chatOpen);
    $("#chat-close").onclick = () => toggleChat(false);
    $$("[data-ct]").forEach((b) => (b.onclick = () => { chatTab = b.dataset.ct; drawChat(); if (chatTab !== "board") $("#chat-in").focus(); }));
    $("#chat-form").onsubmit = async (e) => {
      e.preventDefault();
      const inp = $("#chat-in"), v = inp.value.trim();
      if (!v || chatTab === "board") return;
      inp.value = "";
      try { await NET.post(chatTab === "team" ? "team" : "all", v, { pid: NET.me.pid }); }
      catch (err) { inp.value = v; toast("메시지를 보내지 못했어요.", "bad"); }
    };
    drawChat();
  }
  function chatHide() { $("#chat-fab").hidden = true; $("#chat").hidden = true; chatOpen = false; renderTeamBar(); }
  function toggleChat(on) {
    chatOpen = on;
    $("#chat").hidden = !on;
    $("#chat-fab").setAttribute("aria-expanded", on);
    if (on) drawChat();
    if (on && chatTab !== "board") setTimeout(() => $("#chat-in").focus({ preventScroll: true }), 50);
  }

  function msgHtml(m) {
    const mine = m.team_id === NET.team.id, me = m.meta && m.meta.pid === NET.me.pid;
    const who = `<span class="m-who">${esc(m.author)}${m.scope !== "team" && m.meta && m.meta.team ? `<em>${esc(m.meta.team)}</em>` : ""}</span><time>${hhmm(m.created_at)}</time>`;
    if (m.scope === "notice") return `<li class="m notice">${ic("ti-speakerphone")}<div><span class="m-who">진행자 공지</span><p>${esc(m.body)}</p></div></li>`;
    return `<li class="m ${me ? "me" : ""}"><div>${who}<p>${esc(m.body)}</p></div></li>`;
  }

  function boardHtml() {
    const rows = NET.ranking();
    if (!rows.length) return `<p class="note">아직 입장한 조가 없어요.</p>`;
    return `<ol class="ranks">${rows.map(({ t, p }, i) => `
      <li class="${t.id === NET.team.id ? "mine" : ""} ${p.done ? "done" : ""}">
        <span class="b-rank">${p.done ? i + 1 : "–"}</span>
        <div class="b-main"><b>${esc(t.name)}</b>
          <span class="b-bar"><i style="width:${p.pct}%"></i></span>
          <small>${p.done ? "탈출 완료" : p.label} · ${ic("ti-users")} ${NET.onlineOf(t.id).length}명 · 힌트 ${p.hints}${p.firsts ? ` · ${ic("ti-medal")} 첫 탈출 ${p.firsts}` : ""}${p.clean ? ` · ${ic("ti-bulb-off")} 힌트 없이 ${p.clean}` : ""}</small></div>
        <span class="b-time">${NET.fmt(p.sec)}</span>
      </li>`).join("")}</ol>`;
  }

  function drawChat() {
    if (!chatReady) return;
    const badge = $("#chat-badge"), total = unread.team + unread.all;
    badge.hidden = !total; badge.textContent = total > 9 ? "9+" : total;
    $$("[data-ct]").forEach((b) => {
      b.classList.toggle("on", b.dataset.ct === chatTab);
      b.setAttribute("aria-selected", b.dataset.ct === chatTab);
      const n = unread[b.dataset.ct];
      b.dataset.n = n ? n : "";
    });
    if (!chatOpen) return;
    if (chatTab !== "board") unread[chatTab] = 0;
    badge.hidden = !(unread.team + unread.all);
    const bodyEl = $("#chat-body");
    $("#chat-form").hidden = chatTab === "board";
    $("#chat-in").placeholder = chatTab === "team" ? `${NET.team.name}에게 보내기` : "모든 조에게 보내기";
    if (chatTab === "board") { bodyEl.innerHTML = boardHtml(); return; }
    const list = NET.messages.filter((m) => tabOf(m) === chatTab && (chatTab !== "team" || m.team_id === NET.team.id));
    bodyEl.innerHTML = list.length ? `<ul class="msgs">${list.map(msgHtml).join("")}</ul>`
      : `<p class="note center">${fix(chatTab === "team" ? "조원과 단서를 나누는 곳이에요.\n내 화면의 단서를 적어 보세요." : "모든 조가 함께 보는 곳이에요.\n진행자 공지도 여기에 남아요.")}</p>`;
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function drawEndBoards() {
    const b = $("#end-board"), w = $("#end-wall");
    if (b) b.innerHTML = boardHtml();
    if (w) {
      const ls = NET.messages.filter((m) => m.scope === "letter");
      w.innerHTML = ls.length ? ls.map((m) => `<figure class="lw-card"><blockquote>${esc(m.body)}</blockquote><figcaption>${esc(m.author)} · ${esc(m.meta.team || "")}</figcaption></figure>`).join("")
        : `<p class="note">${fix("아직 편지가 없어요.")}</p>`;
    }
  }

  /* ═════════ 시작 ═════════ */
  $("#disclaimer").innerHTML = fix(C.meta.disclaimer);
  document.title = `${C.meta.title} | ${C.meta.subtitle}`;
  // 새로고침했을 때: 조에 다시 연결해서 조의 최신 장면으로 이어 간다
  const netSaved = NET && NET.saved();
  if (netSaved && netSaved.code && S.scene !== "start" && !S.demo) {
    main.innerHTML = `<section class="card story"><p class="line center">${fix(`${netSaved.teamName}에 다시 연결하는 중이에요…`)}</p></section>`;
    NET.join(netSaved.code, netSaved.teamName, netSaved.name).then((st) => {
      takeTeam(st.state || {});
      if (S.scene === "start") S.scene = "prologue";
      chatInit(); render();
    }).catch(() => { S.scene = "start"; render(); toast("조에 다시 연결하지 못했어요.\n입장 코드를 확인해 주세요.", "bad"); });
  } else render();
})();
