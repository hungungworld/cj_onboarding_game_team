/* 실시간 연결: 입장, 조 진행 상황 공유, 접속자 표시, 메시지
 * game.js와 host.js가 함께 쓴다. 연결 정보는 js/config.js
 */
(function () {
  "use strict";
  const CFG = window.NET_CONFIG;
  const KEY = "cj-team-net";
  const db = window.supabase.createClient(CFG.url, CFG.key, { realtime: { params: { eventsPerSecond: 20 } } });

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16);
    }));

  const listeners = { team: [], teams: [], presence: [], message: [], status: [] };
  const emit = (ev, ...a) => listeners[ev].forEach((f) => { try { f(...a); } catch (e) { console.error(e); } });

  const NET = {
    db,
    active: false,          // 입장해서 실시간으로 연결된 상태
    me: null,               // { pid, name, since }
    session: null,          // { id, code, title }
    team: null,             // { id, name }
    teams: {},              // 이 회차의 모든 조 { id: row }
    online: [],             // 이 회차에 접속 중인 사람 [{ pid, name, team, since, scene }]
    messages: [],
    ver: 0,
    channel: null,

    on(ev, f) { listeners[ev].push(f); },

    saved() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } },
    remember() {
      localStorage.setItem(KEY, JSON.stringify({ pid: this.me.pid, secret: this.me.secret, name: this.me.name, since: this.me.since,
        code: this.session.code, teamName: this.team.name }));
    },
    forget() { localStorage.removeItem(KEY); },

    /* 입장: 조가 없으면 새로 만든다. 반환값은 조의 공유 상태 */
    async join(code, teamName, name) {
      const old = this.saved();
      const sameTeam = old && old.code === code && old.teamName === teamName;
      const pid = old && old.pid && old.secret ? old.pid : uuid();
      const secret = old && old.pid === pid && old.secret ? old.secret : uuid() + uuid(); // 이 기기만 아는 비밀값 (아이디는 다른 조원에게 보임)
      const { data, error } = await db.rpc("join_session", { p_code: code, p_team: teamName, p_player: pid, p_secret: secret, p_name: name });
      if (error) throw new Error(error.message);
      this.me = { pid, secret, name, since: sameTeam && old.since ? old.since : Date.now() };
      this.session = data.session;
      this.team = { id: data.team.id, name: data.team.name };
      this.ver = data.team.ver;
      this.remember();
      await this.connect();
      return data.team;
    },

    async connect() {
      if (this.channel) await db.removeChannel(this.channel);
      const sid = this.session.id;
      const [{ data: teams }, { data: msgs }] = await Promise.all([
        db.from("teams").select("*").eq("session_id", sid),
        db.from("messages").select("*").eq("session_id", sid).order("id", { ascending: false }).limit(150)
      ]);
      this.teams = {};
      (teams || []).forEach((t) => (this.teams[t.id] = t));
      this.messages = (msgs || []).reverse();

      const ch = db.channel("session:" + sid, { config: { presence: { key: this.me ? this.me.pid : "host-" + uuid() } } });
      ch.on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: "session_id=eq." + sid }, (p) => {
        const t = p.new;
        if (!t || !t.id) return;
        this.teams[t.id] = t;
        emit("teams", this.teams);
        if (this.team && t.id === this.team.id) this.gotState(t.state, t.ver);
      });
      ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "session_id=eq." + sid }, (p) => {
        if (this.messages.some((m) => m.id === p.new.id)) return;
        this.messages.push(p.new);
        if (this.messages.length > 300) this.messages.shift();
        emit("message", p.new);
      });
      ch.on("presence", { event: "sync" }, () => {
        const st = ch.presenceState();
        this.online = Object.values(st).map((arr) => arr[0]).filter((x) => x && x.pid);
        emit("presence", this.online);
      });
      this.channel = ch;
      await new Promise((res) => {
        ch.subscribe(async (status) => {
          emit("status", status);
          if (status === "SUBSCRIBED") {
            if (this.me) await this.track();
            res();
          }
        });
        setTimeout(res, 6000); // 사내망 등에서 실시간 연결이 늦어도 화면은 진행
      });
      this.active = !!this.me;
      emit("teams", this.teams);
    },

    scene: "",
    track(scene) {
      if (scene !== undefined) this.scene = scene;
      if (!this.channel || !this.me) return;
      return this.channel.track({ pid: this.me.pid, name: this.me.name, team: this.team.id, teamName: this.team.name,
        since: this.me.since, scene: this.scene });
    },

    /* 서버가 보낸 새 상태 (오래된 것은 버림) */
    gotState(state, ver) {
      if (ver <= this.ver) return;
      this.ver = ver;
      emit("team", state || {}, ver);
    },

    /* 조 상태 바꾸기: 순서대로 하나씩 보낸다 */
    queue: Promise.resolve(),
    apply(ops) {
      if (!this.active || !ops.length) return;
      this.queue = this.queue.then(async () => {
        const { data, error } = await db.rpc("team_apply", { p_team: this.team.id, p_player: this.me.pid, p_secret: this.me.secret, p_ops: ops });
        if (error) { console.warn("team_apply", error.message); emit("status", "SAVE_ERROR"); return; }
        this.gotState(data.state, data.ver);
      });
      return this.queue;
    },

    async post(scope, body, meta = {}) {
      if (!this.active) return;
      const { error } = await db.rpc("post_message", { p_player: this.me.pid, p_secret: this.me.secret, p_scope: scope, p_body: body, p_meta: meta });
      if (error) throw new Error(error.message);
    },

    /* 우리 조에서 지금 접속 중인 사람 (먼저 들어온 순서). 나는 항상 포함 */
    members() {
      if (!this.active) return [];
      const list = this.online.filter((p) => p.team === this.team.id);
      if (!list.some((p) => p.pid === this.me.pid)) list.push({ pid: this.me.pid, name: this.me.name, since: this.me.since });
      return list.sort((a, b) => (a.since - b.since) || (a.pid < b.pid ? -1 : 1));
    },
    myIndex() { return this.members().findIndex((p) => p.pid === this.me.pid); },

    /* 조별 현황판 */
    STEPS: ["prologue", "room1", "room2", "room3", "room4", "room5", "act2", "act3", "ending"],
    STEP_LABEL: ["프롤로그", "로비", "회의실", "키친", "연구소", "라운지", "추리", "캡슐", "엔딩"],
    progress(t) {
      const s = (t && t.state) || {};
      const idx = Math.max(0, this.STEPS.indexOf(s.scene));
      const sec = s.start ? ((s.end || Date.now()) - s.start) / 1000 + (s.penalty || 0) : 0;
      return { idx, label: s.start ? this.STEP_LABEL[idx] : "대기", pct: s.end ? 100 : Math.round((idx / (this.STEPS.length - 1)) * 100),
        done: !!s.end, sec, hints: s.hintsUsed || 0, help: t.help_count || 0 };
    },
    ranking() {
      return Object.values(this.teams).map((t) => ({ t, p: this.progress(t) })).sort((a, b) =>
        (b.p.done - a.p.done) || (a.p.done ? a.p.sec - b.p.sec : (b.p.idx - a.p.idx) || (a.p.sec - b.p.sec)));
    },
    fmt(sec) { sec = Math.max(0, Math.floor(sec)); return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); },
    onlineOf(teamId) { return this.online.filter((p) => p.team === teamId); }
  };

  window.NET = NET;
})();
