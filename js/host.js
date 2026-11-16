/* 진행자 화면: 회차 열기 → 입장 코드 안내 → 조별 현황 · 공지 · 전체 대화 · 편지 벽 */
(function () {
  "use strict";
  const NET = window.NET;
  const KEY = "cj-team-host";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n) => `<i class="ti ${n}" aria-hidden="true"></i>`;
  const root = $("#host");
  const toast = (msg, kind = "") => {
    const t = document.createElement("div");
    t.className = "toast " + kind; t.innerHTML = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => t.classList.add("out"), 2600); setTimeout(() => t.remove(), 3100);
  };
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  let H = saved();

  function renderCreate() {
    root.innerHTML = `
      <section class="card h-create">
        <h1>${ic("ti-door-enter")} 새 회차 열기</h1>
        <p>회차를 열면 참가자가 넣을 <b>입장 코드 4자리</b>가 만들어져요.</p>
        <label class="field">회차 이름<input id="h-title" maxlength="40" placeholder="예: 2026 하반기 신입 입문 교육 1반"></label>
        <button class="btn primary big" id="h-make">${ic("ti-plus")} 회차 열기</button>
        ${H ? `<button class="btn" id="h-back">${ic("ti-history")} 진행 중이던 회차 (${esc(H.code)})로 돌아가기</button>` : ""}
      </section>`;
    $("#h-make").onclick = async () => {
      const { data, error } = await NET.db.rpc("create_session", { p_title: $("#h-title").value.trim() });
      if (error) { toast("회차를 열지 못했어요: " + esc(error.message), "bad"); return; }
      H = { id: data.id, code: data.code, key: data.host_key, title: $("#h-title").value.trim() };
      localStorage.setItem(KEY, JSON.stringify(H));
      start();
    };
    const b = $("#h-back"); if (b) b.onclick = start;
  }

  async function start() {
    NET.session = { id: H.id, code: H.code, title: H.title };
    const { data: s } = await NET.db.from("sessions").select("status").eq("id", H.id).maybeSingle();
    if (!s) { localStorage.removeItem(KEY); H = null; return renderCreate(); }
    const link = `${location.origin}${location.pathname.replace(/host\.html$/, "")}?s=${H.code}`;
    root.innerHTML = `
      <section class="h-top">
        <div class="card h-code">
          <p class="eyebrow">${esc(H.title || "이번 회차")} ${s.status === "ended" ? "· 종료됨" : ""}</p>
          <p class="h-big">${esc(H.code)}</p>
          <p>참가자 화면에서 <b>입장 코드</b>에 이 숫자를 넣어요.</p>
          <p class="h-link"><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>
            <button class="btn small" id="h-copy">${ic("ti-copy")} 링크 복사</button></p>
          <p class="h-stat" id="h-stat"></p>
        </div>
        <form class="card h-notice" id="h-notice">
          <h2 class="panel-title">${ic("ti-speakerphone")} 전체 공지</h2>
          <label class="field"><span class="sr-only">공지 내용</span><textarea id="h-msg" rows="3" maxlength="300" placeholder="예: 10분 남았어요! 힌트 없이 끝까지 생각해 보세요."></textarea></label>
          <div class="h-quick">${["시작합니다! 조원과 단서를 나눠 보세요.", "10분 남았어요!", "단서를 한 장도 빼먹지 말고 모두 합쳐 보세요.", "지금 1위 조가 캡슐에 도착했어요!"]
            .map((q) => `<button type="button" class="btn small" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
          <div class="row"><button class="btn primary">보내기</button></div>
        </form>
      </section>
      <section class="h-grid">
        <div class="card"><h2 class="panel-title">${ic("ti-trophy")} 조별 현황</h2><div id="h-board"></div></div>
        <div class="card"><h2 class="panel-title">${ic("ti-world")} 전체 대화</h2><ul class="msgs h-feed" id="h-feed"></ul></div>
      </section>
      <section class="card"><h2 class="panel-title">${ic("ti-mail-opened")} 100주년 메시지 벽</h2><div class="letter-wall" id="h-wall"></div></section>
      <section class="h-foot">
        <button class="btn" id="h-new">${ic("ti-plus")} 새 회차 열기</button>
        <button class="btn" id="h-end" ${s.status === "ended" ? "disabled" : ""}>${ic("ti-flag")} 이 회차 끝내기 (새 입장 막기)</button>
      </section>`;

    $("#h-copy").onclick = () => navigator.clipboard.writeText(link).then(() => toast("링크를 복사했어요.", "good"));
    $$("[data-q]").forEach((b) => (b.onclick = () => { $("#h-msg").value = b.dataset.q; $("#h-msg").focus(); }));
    $("#h-notice").onsubmit = async (e) => {
      e.preventDefault();
      const v = $("#h-msg").value.trim();
      if (!v) return;
      const { error } = await NET.db.rpc("host_post", { p_session: H.id, p_key: H.key, p_body: v });
      if (error) { toast("공지를 보내지 못했어요.", "bad"); return; }
      $("#h-msg").value = ""; toast("공지를 보냈어요.", "good");
    };
    $("#h-new").onclick = renderCreate;
    $("#h-end").onclick = async () => {
      if (!window.confirm("이 회차를 끝낼까요? 새로 입장할 수 없게 돼요.")) return;
      await NET.db.rpc("host_end", { p_session: H.id, p_key: H.key });
      start();
    };

    NET.on("teams", draw); NET.on("presence", draw); NET.on("message", draw);
    await NET.connect();
    draw();
    setInterval(draw, 5000); // 진행 시간 갱신
  }

  function draw() {
    const rows = NET.ranking();
    const b = $("#h-board");
    if (!b) return;
    $("#h-stat").innerHTML = `${ic("ti-users")} 접속 ${NET.online.length}명 · 조 ${rows.length}개 · 탈출 ${rows.filter((r) => r.p.done).length}조`;
    b.innerHTML = rows.length ? `<ol class="ranks">${rows.map(({ t, p }, i) => {
      const people = NET.onlineOf(t.id);
      return `<li class="${p.done ? "done" : ""}"><span class="b-rank">${p.done ? i + 1 : "–"}</span>
        <div class="b-main"><b>${esc(t.name)}</b><span class="b-bar"><i style="width:${p.pct}%"></i></span>
          <small>${p.done ? "탈출 완료" : esc(p.label)} · 힌트 ${p.hints} · ${ic("ti-medal")} 첫 탈출 ${p.firsts} · ${ic("ti-bulb-off")} 힌트 없이 ${p.clean}곳 · ${people.length ? people.map((x) => esc(x.name)).join(", ") : "접속자 없음"}</small></div>
        <span class="b-time">${NET.fmt(p.sec)}</span></li>`;
    }).join("")}</ol>
      ${awards(rows)}` : `<p class="note">아직 입장한 조가 없어요.</p>`;

    const feed = NET.messages.filter((m) => ["all", "notice"].includes(m.scope)).slice(-60);
    const f = $("#h-feed");
    f.innerHTML = feed.map((m) => {
      const who = `<span class="m-who">${esc(m.author)}${m.meta && m.meta.team ? `<em>${esc(m.meta.team)}</em>` : ""}</span>`;
      const pre = m.scope === "notice" ? ic("ti-speakerphone") : "";
      return `<li class="m ${m.scope}">${pre}<div>${who}<p>${esc(m.body)}</p></div></li>`;
    }).join("") || `<li class="note">아직 대화가 없어요.</li>`;
    f.scrollTop = f.scrollHeight;

    const ls = NET.messages.filter((m) => m.scope === "letter");
    $("#h-wall").innerHTML = ls.map((m) => `<figure class="lw-card"><blockquote>${esc(m.body)}</blockquote><figcaption>${esc(m.author)} · ${esc(m.meta.team || "")}</figcaption></figure>`).join("")
      || `<p class="note">아직 편지가 없어요.</p>`;
  }

  // 시상 후보: 최단 기록 · 생각왕(힌트 없이 푼 지점이 가장 많은 조, 같으면 기록순) · 첫 탈출 메달왕
  function awards(rows) {
    const top = (f) => rows.slice().sort((a, b) => f(b) - f(a))[0];
    const fast = rows.find((r) => r.p.done);
    const think = rows.slice().sort((a, b) => (b.p.clean - a.p.clean) || (a.p.sec - b.p.sec))[0], first = top((r) => r.p.firsts);
    const card = (icon, title, r, val) => `<div class="aw">${ic(icon)}<small>${title}</small><b>${r ? esc(r.t.name) : "—"}</b><span>${r ? val : ""}</span></div>`;
    return `<div class="awards">
      ${card("ti-trophy", "최단 기록", fast, fast ? NET.fmt(fast.p.sec) : "")}
      ${card("ti-bulb", "생각왕", think && think.p.clean ? think : null, think ? `힌트 없이 ${think.p.clean}곳` : "")}
      ${card("ti-medal", "첫 탈출 메달왕", first && first.p.firsts ? first : null, first ? `메달 ${first.p.firsts}개` : "")}
    </div>`;
  }

  if (H) start(); else renderCreate();
})();
