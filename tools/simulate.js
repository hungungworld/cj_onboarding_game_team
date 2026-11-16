/* 3개 조 × 5명 시뮬레이션: node tools/simulate.js
 * - 진짜 Supabase 서버에 봇 15명이 입장해서, 브라우저와 같은 함수로 게임을 진행한다.
 * - 시간 압축: 게임 1분 = 실제 G밀리초 (기본 3초). 결과는 게임 분으로 바꿔 보여 준다.
 * - 조마다 실력(속도)이 다르다. 오래 막히면 힌트를 열지, 힌트 없이 더 생각할지 고른다 (생각왕 경쟁).
 * - 끝나면 진행자 화면 링크와 결과표를 출력한다. 회차는 지우지 않는다 (진행자 화면에서 보려고).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const cfgText = fs.readFileSync(path.join(__dirname, "..", "js", "config.js"), "utf8");
const URL = cfgText.match(/url:\s*"([^"]+)"/)[1];
const KEY = cfgText.match(/key:\s*"([^"]+)"/)[1];
const G = Number(process.env.G_MS) || 3000;           // 게임 1분 = G ms
const SEED = Number(process.env.SEED) || 7;
const SITE = process.env.SITE || "http://localhost:5174";

/* ── 재현 가능한 난수 ── */
let rs = SEED;
const rand = () => ((rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rand() * a.length)];
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sleepG = (gm) => sleep(gm * G);
const t0 = Date.now();
const gmin = (ms) => ms / G;
const clock = () => gmin(Date.now() - t0).toFixed(1).padStart(5) + "분";
const log = (...a) => console.log(`[${clock()}]`, ...a);

/* ── 서버 함수 호출 ── */
let apiCalls = 0, apiErrors = 0;
async function rpc(name, args) {
  apiCalls++;
  const r = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(args)
  });
  const text = await r.text();
  if (!r.ok) { apiErrors++; throw new Error(`${name}: ${text}`); }
  return text ? JSON.parse(text) : null;
}
async function select(q) {
  apiCalls++;
  const r = await fetch(`${URL}/rest/v1/${q}`, { headers: { apikey: KEY } });
  if (!r.ok) { apiErrors++; throw new Error(await r.text()); }
  return r.json();
}

/* ── 접속자 표시(presence): 브라우저와 같은 실시간 채널에 들어간다 ── */
let wsRef = 0;
function presence(sessionId, meta) {
  return new Promise((resolve) => {
    let ws;
    try { ws = new WebSocket(`${URL.replace("https", "wss")}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`); }
    catch (e) { return resolve(null); }
    const topic = `realtime:session:${sessionId}`;
    const send = (event, payload, t = topic) => ws.readyState === 1 && ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++wsRef) }));
    let hb;
    ws.onopen = () => {
      send("phx_join", { config: { broadcast: { ack: false, self: false }, presence: { key: meta.pid, enabled: true }, postgres_changes: [], private: false } });
      hb = setInterval(() => send("heartbeat", {}, "phoenix"), 25000);
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.event === "phx_reply" && m.topic === topic && m.payload.status === "ok" && !ws.joined) {
        ws.joined = true;
        send("presence", { type: "presence", event: "track", payload: meta });
        resolve({ update: (patch) => send("presence", { type: "presence", event: "track", payload: Object.assign(meta, patch) }), close: () => { clearInterval(hb); ws.close(); } });
      }
    };
    ws.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
  });
}

/* ── 게임 데이터 (v2: 단서를 합쳐 추리하는 퍼즐이라 방마다 5~7분) ── */
const SPOTS = [
  { key: "room1", scene: "room1", label: "로비", base: 5.5, reward: { id: "onlyone", label: "열쇠 단어 ONLYONE", icon: "ti-key" } },
  { key: "room2", scene: "room2", label: "회의실", base: 6 },
  { key: "room3", scene: "room3", label: "키친", base: 5 },
  { key: "room4", scene: "room4", label: "연구소", base: 6 },
  { key: "room5", scene: "room5", label: "라운지", base: 5.5 },
  { key: "act2", scene: "act2", label: "2막 추리", base: 4.5, reward: { id: "health", label: "단어 조각 '건강'", icon: "ti-puzzle" } },
  { key: "act3-0", scene: "act3", label: "캡슐 ①", base: 3 },
  { key: "act3-1", scene: "act3", label: "캡슐 ②", base: 3 },
  { key: "act3-2", scene: "act3", label: "캡슐 ③", base: 2.5 }
];
const TEAMS = [
  { name: "비비고 조", skill: 0.8, people: ["김민지", "박서준", "이하늘", "최도윤", "정세린"] },
  { name: "햇반 조", skill: 1.0, people: ["한지우", "오채원", "윤현우", "강예린", "신태오"] },
  { name: "다시다 조", skill: 1.3, people: ["임소율", "조건우", "배나래", "홍지안", "서유진"] }
];
const TALK = {
  room1: ["제 메모엔 제분이 설탕 5년 뒤래요", "그럼 제분 1958년이네요", "백설에서 10년 뒤가 다시다예요"],
  room2: ["A는 품질안전팀 메모랑 안 맞아요", "새 포장 2주면 행사 못 맞추죠", "D는 안 알리니까 팀장님 메모에 걸려요"],
  room3: ["메인은 미국 만두 1위래요", "국물은 장류 말고 조미료!", "디저트는 설탕 브랜드로요"],
  room4: ["홀수 탱크가 라이신이래요", "트립토판은 32도까지예요", "⑧번이 34도라 벗어났어요"],
  room5: ["서준님은 4시부터 된대요", "현우님은 5시부터 화상회의", "회의실 4시~4시 반 비어 있어요"],
  act2: ["TF-30이 9시 10분에 보관함을 열었어요", "TF는 30주년 TF예요", "저는 한햇님에 한 표"],
  "act3-0": ["A: 햇반, 비비고, 다시다, 쁘띠첼 순서예요", "B: 햇반은 빨강이에요", "C: 빨강은 4번"],
  "act3-1": ["A: 핀 5번이 일본이에요", "B: 일본 치바 공장이 제일 최근", "C: 공장 지은 나라 먼저래요"],
  "act3-2": ["비전 문장 순서대로 끼우래요", "건강, 즐거움, 편리!", "정직은 함정이에요"]
};

/* ── 기록 ── */
const stats = {};

async function main() {
  log(`시뮬레이션 시작: 게임 1분 = ${G / 1000}초, 난수 ${SEED}`);
  const sess = await rpc("create_session", { p_title: "시뮬레이션: 3개 조 × 5명" });
  log(`회차 코드 ${sess.code}`);
  fs.writeFileSync(path.join(__dirname, "sim-host.json"), JSON.stringify({ id: sess.id, code: sess.code, key: sess.host_key, title: "시뮬레이션: 3개 조 × 5명" }));

  // 15명 입장 (조원은 조금씩 시간차를 두고)
  const teams = [];
  for (const T of TEAMS) {
    const team = { ...T, members: [], solved: new Set(), local: { penalty: 0, hints: 0, moves: {} } };
    for (let i = 0; i < T.people.length; i++) {
      const pid = crypto.randomUUID(), secret = crypto.randomUUID() + crypto.randomUUID();
      const r = await rpc("join_session", { p_code: sess.code, p_team: T.name, p_player: pid, p_secret: secret, p_name: T.people[i] });
      team.id = r.team.id;
      const m = { pid, secret, name: T.people[i], idx: i };
      m.pres = await presence(sess.id, { pid, name: m.name, team: team.id, teamName: T.name, since: Date.now(), scene: "prologue" });
      team.members.push(m);
      await sleep(80);
    }
    stats[T.name] = { hintsTaken: 0, thoughtThrough: 0, wrongVotes: 0, spotTimes: {} };
    teams.push(team);
    log(`${T.name} 5명 입장 (실시간 접속 ${team.members.filter((m) => m.pres).length}/5)`);
  }

  const apply = (team, m, ops) => rpc("team_apply", { p_team: team.id, p_player: m.pid, p_secret: m.secret, p_ops: ops });
  const post = (m, scope, body, meta = {}) => rpc("post_message", { p_player: m.pid, p_secret: m.secret, p_scope: scope, p_body: body, p_meta: meta });

  /* 한 조의 게임 진행 */
  async function playTeam(team) {
    const S = stats[team.name];
    const any = () => pick(team.members);
    await apply(team, team.members[0], [{ op: "init", p: ["start"], v: Date.now() }, { op: "init", p: ["scene"], v: "prologue" }]);
    await sleepG(0.5 + rand() * 0.5);
    let scene = "prologue";
    for (const sp of SPOTS) {
      if (sp.scene !== scene) {
        scene = sp.scene;
        await apply(team, any(), [{ op: "set", p: ["scene"], v: scene }]);
        team.members.forEach((m) => m.pres && m.pres.update({ scene }));
      }
      const start = Date.now();
      let need = sp.base * team.skill * Math.exp(gauss() * 0.35);
      let decided = false;
      const el = () => gmin(Date.now() - start);
      while (el() < need) {
        await sleepG(0.4 + rand() * 0.3);
        // 조원 여러 명이 동시에 퍼즐 판의 서로 다른 칸을 표시 (일정표·탱크 점검판처럼)
        const movers = team.members.filter(() => rand() < 0.4);
        await Promise.all(movers.map((m) => {
          team.local.moves[m.idx] = (team.local.moves[m.idx] || 0) + 1;
          return apply(team, m, [{ op: "set", p: ["puzzle", sp.key, "m" + m.idx], v: team.local.moves[m.idx] }]).catch(() => {});
        }));
        if (rand() < 0.45) post(any(), "team", pick(TALK[sp.key])).catch(() => {});
        // 4분이 지나도 못 풀면: 힌트를 열거나(빨라지지만 +1분), 힌트 없이 더 생각한다(생각왕)
        if (!decided && el() > 4 && need - el() > 0.8) {
          decided = true;
          if (rand() < 0.55) { await takeHint(team, sp, S); need = el() + (need - el()) * 0.6; }
          else { S.thoughtThrough++; log(`🤔 ${team.name} ${sp.label} 힌트 없이 더 생각하기`); }
        }
      }
      // 2막: 5명 투표 (가끔 첫 투표가 엇갈려 틀림)
      if (sp.key === "act2") {
        if (rand() < 0.3) {
          await Promise.all(team.members.map((m, i) => apply(team, m, [{ op: "set", p: ["act2", "votes", m.pid], v: i < 3 ? 1 : 4 }])));
          await apply(team, any(), [{ op: "inc", p: ["penalty"], v: 60 }, { op: "set", p: ["act2", "votes"], v: {} }]);
          team.local.penalty += 60; S.wrongVotes++;
          log(`   ❌ ${team.name} 2막 첫 투표 실패 (+1분)`);
          await sleepG(1);
        }
        await Promise.all(team.members.map((m) => apply(team, m, [{ op: "set", p: ["act2", "votes", m.pid], v: 4 }])));
      }
      const ops = [{ op: "set", p: ["solved", sp.key], v: true }, { op: "init", p: ["clearedAt", sp.key], v: Date.now() }];
      if (sp.reward) ops.push({ op: "add", p: ["items"], v: sp.reward });
      if (sp.key.startsWith("act3")) ops.push({ op: "set", p: ["act3Step"], v: +sp.key.slice(-1) + 1 });
      if (sp.key === "act2") ops.push({ op: "set", p: ["act2", "done"], v: true });
      await apply(team, any(), ops);
      team.solved.add(sp.key);
      S.spotTimes[sp.key] = el();
      log(`✅ ${team.name} ${sp.label} (${el().toFixed(1)}분)`);
    }
    await apply(team, any(), [{ op: "init", p: ["end"], v: Date.now() }, { op: "set", p: ["scene"], v: "ending" }]);
    team.finished = true;
    log(`🏁 ${team.name} 탈출!`);
    const letters = ["세계 모든 식탁에서 K-Food를 만나고 있기를!", "100주년엔 우리가 선배가 되어 있을게요.", "오늘 같이 푼 동기들, 계속 서로의 단서가 되자!", "ONLYONE 레시피의 다음 장을 우리가 썼기를.", "건강, 즐거움, 편리를 지구 끝까지!"];
    for (const m of team.members) { await sleepG(0.2 + rand() * 0.6); await post(m, "letter", letters[m.idx]).catch(() => {}); }
  }

  async function takeHint(team, sp, S) {
    await apply(team, pick(team.members), [{ op: "inc", p: ["penalty"], v: 60 }, { op: "inc", p: ["hintsUsed"], v: 1 }, { op: "set", p: ["hintLv", sp.key], v: 1 }]);
    team.local.penalty += 60; team.local.hints++; S.hintsTaken++;
    log(`💡 ${team.name} ${sp.label} 힌트 1 (+1분)`);
  }

  // 진행자 공지 몇 개
  setTimeout(() => rpc("host_post", { p_session: sess.id, p_key: sess.host_key, p_body: "시작합니다! 조원과 단서를 나눠 보세요." }), 0.2 * G);
  setTimeout(() => rpc("host_post", { p_session: sess.id, p_key: sess.host_key, p_body: "단서를 한 장도 빼먹지 말고 모두 합쳐 보세요." }), 12 * G);

  await Promise.all(teams.map(playTeam));
  await sleepG(2.5);

  /* ── 결과 ── */
  const rows = await select(`teams?session_id=eq.${sess.id}&select=id,name,state,ver`);
  const firsts = {};
  rows.forEach((t) => Object.entries(t.state.clearedAt || {}).forEach(([k, at]) => { if (!firsts[k] || at < firsts[k].at) firsts[k] = { at, team: t.name }; }));
  const result = rows.map((t) => {
    const s = t.state, raw = gmin(s.end - s.start);
    const score = raw + (s.penalty || 0) / 60; // 벌점 60초 = 게임 1분
    const hl = s.hintLv || {}, clean = Object.keys(s.clearedAt || {}).filter((k) => !hl[k]).length;
    return { t, s, raw, score, clean, medals: Object.values(firsts).filter((f) => f.team === t.name).length };
  }).sort((a, b) => a.score - b.score);

  const team = (n) => teams.find((x) => x.name === n);
  console.log("\n════════ 결과 (게임 분 기준) ════════");
  console.log("순위  조          걸린시간  벌점  최종기록  첫탈출메달  힌트  힌트없이 푼 곳");
  result.forEach((r, i) => {
    console.log(`${i + 1}위   ${r.t.name.padEnd(8)}  ${r.raw.toFixed(1).padStart(6)}분  +${((r.s.penalty || 0) / 60).toFixed(0)}분  ${r.score.toFixed(1).padStart(6)}분  ${String(r.medals).padStart(6)}개    ${String(r.s.hintsUsed || 0).padStart(3)}   ${r.clean}/9`);
  });
  const think = result.slice().sort((a, b) => (b.clean - a.clean) || (a.score - b.score))[0];
  console.log(`\n시상 후보: 최단 기록 ${result[0].t.name} · 생각왕 ${think.t.name} (힌트 없이 ${think.clean}곳) · 첫 탈출 메달왕 ${result.slice().sort((a, b) => b.medals - a.medals)[0].t.name}`);
  console.log("구간별 평균 (게임 분): " + SPOTS.map((sp) => `${sp.label} ${(TEAMS.reduce((a, T) => a + (stats[T.name].spotTimes[sp.key] || 0), 0) / TEAMS.length).toFixed(1)}`).join(" · "));

  // 동시 쓰기 확인: 조원 5명이 같은 순간에 써도 값이 사라지지 않았는지
  let lost = 0, checked = 0;
  rows.forEach((t) => {
    const T = team(t.name);
    if ((t.state.penalty || 0) !== T.local.penalty) { lost++; console.log(`  ⚠ ${t.name} 벌점 서버 ${t.state.penalty} ≠ 기대 ${T.local.penalty}`); }
    const votes = (t.state.act2 && t.state.act2.votes) || {};
    if (Object.values(votes).filter((v) => v === 4).length !== 5) { lost++; console.log(`  ⚠ ${t.name} 2막 표 ${JSON.stringify(votes)}`); }
    checked += 2;
    SPOTS.forEach((sp) => T.members.forEach((m) => {
      const v = ((t.state.puzzle || {})[sp.key] || {})["m" + m.idx];
      if (v !== undefined) checked++;
    }));
  });
  console.log(`\n동시 쓰기 확인: 검사 ${checked}개 중 사라진 값 ${lost}개`);
  console.log(`서버 호출 ${apiCalls}회, 오류 ${apiErrors}회`);
  console.log(`\n진행자 화면: ${SITE}/host.html  (tools/sim-host.json의 키로 열기)`);
  teams.forEach((t) => t.members.forEach((m) => m.pres && m.pres.close()));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
