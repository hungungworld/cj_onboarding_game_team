/* 3개 조 × 5명 시뮬레이션: node tools/simulate.js
 * - 진짜 Supabase 서버에 봇 15명이 입장해서, 브라우저와 같은 함수로 게임을 진행한다.
 * - 시간 압축: 게임 1분 = 실제 G밀리초 (기본 3초). 결과는 게임 분으로 바꿔 보여 준다.
 * - 조마다 실력(속도)이 다르고, 막히면 SOS 또는 힌트를 고른다. 각 조의 5번째 조원이 '상생 대사'로 다른 조 SOS를 맡는다.
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

/* ── 게임 데이터 ── */
const SPOTS = [
  { key: "room1", scene: "room1", label: "로비", base: 4, reward: { id: "onlyone", label: "열쇠 단어 ONLYONE", icon: "ti-key" } },
  { key: "room2", scene: "room2", label: "회의실", base: 5 },
  { key: "room3", scene: "room3", label: "키친", base: 4 },
  { key: "room4", scene: "room4", label: "연구소", base: 5 },
  { key: "room5", scene: "room5", label: "라운지", base: 3.5 },
  { key: "act2", scene: "act2", label: "2막 추리", base: 5, reward: { id: "health", label: "단어 조각 '건강'", icon: "ti-puzzle" } },
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
  room1: ["안내문에 1953년 설탕이 최초래요", "액자 연도 순서대로 걸어 볼게요", "제 메모엔 비밀번호가 일곱 글자래요"],
  room2: ["화이트보드 미션 끝이 지워졌어요", "사업보국 액자가 힌트 같아요", "포스트잇 차별화는 ONLYONE 상자죠?"],
  room3: ["레시피 카드: 즉석밥, 만두, 조미료, 설탕 순서", "선반 칸 번호를 불러 줄게요", "햇반은 3번 칸이에요"],
  room4: ["현미경에 아미노산 이름이 여러 개 보여요", "탱크 글자 B, I, O 나왔어요", "아미노산 몇 개인지 세어 볼게요"],
  room5: ["호칭은 이름 뒤에 님!", "HMR은 가정간편식", "용어 카드 다 뒤집었어요"],
  act2: ["출입 기록 9시 10분에 한○○", "8시 50분 퇴근이라던 사람이 이상해요", "저는 한햇님에 한 표"],
  "act3-0": ["A: 햇반, 비비고, 다시다, 쁘띠첼 순서예요", "B: 햇반은 빨강이에요", "C: 빨강은 4번"],
  "act3-1": ["A: 핀 5번이 일본이에요", "B: 일본 치바 공장이 제일 최근", "C: 공장 지은 나라 먼저래요"],
  "act3-2": ["비전 문장 순서대로 끼우래요", "건강, 즐거움, 편리!", "정직은 함정이에요"]
};
const HELP_TEXT = {
  room1: "액자 속 사건을 오래된 순서대로 생각해 보세요.", room2: "사업보국 뜻을 다시 읽어 보세요. 누구에게 보답하나요?",
  room3: "레시피 카드 순서대로 담고 선반 칸 번호를 읽어 보세요.", room4: "탱크 글자에 현미경 속 아미노산 개수를 붙여 보세요.",
  room5: "고친 호칭에 공통으로 들어간 글자를 보세요.", act2: "증언 시간과 출입 기록 시간이 안 맞는 사람을 찾아보세요.",
  "act3-0": "순서 → 색 → 숫자로 두 번 바꿔 보세요.", "act3-1": "공장이 들어간 카드 중 가장 최근 것부터예요.", "act3-2": "회의실 화이트보드의 비전 문장을 떠올려 보세요."
};

/* ── 기록 ── */
const stats = {};
const sosLog = [];   // { id, team, key, at, helpedAt, helper, thanked, outcome }
let messagesSeen = 0;

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
      const m = { pid, secret, name: T.people[i], idx: i, envoy: i === T.people.length - 1 };
      m.pres = await presence(sess.id, { pid, name: m.name, team: team.id, teamName: T.name, since: Date.now(), scene: "prologue" });
      team.members.push(m);
      await sleep(80);
    }
    stats[T.name] = { sos: 0, sosHelped: 0, hintsTaken: 0, helpsSent: 0, thanksGot: 0, wrongVotes: 0, spotTimes: {} };
    teams.push(team);
    log(`${T.name} 5명 입장 (실시간 접속 ${team.members.filter((m) => m.pres).length}/5)`);
  }

  const apply = (team, m, ops) => rpc("team_apply", { p_team: team.id, p_player: m.pid, p_secret: m.secret, p_ops: ops });
  const post = (m, scope, body, meta = {}) => rpc("post_message", { p_player: m.pid, p_secret: m.secret, p_scope: scope, p_body: body, p_meta: meta });

  /* 메시지 감시: SOS → 상생 대사가 도와주기, 도움 → 받은 조가 고마워요 */
  const inbox = [];
  let stop = false;
  (async function poll() {
    while (!stop) {
      try {
        const rows = await select(`messages?session_id=eq.${sess.id}&id=gt.${messagesSeen}&order=id`);
        rows.forEach((r) => { messagesSeen = Math.max(messagesSeen, r.id); inbox.push(r); onMessage(r); });
      } catch (e) { /* 다음에 다시 */ }
      await sleep(Math.min(1000, G / 3));
    }
  })();

  function onMessage(msg) {
    if (msg.scope !== "sos") return;
    teams.forEach((team) => {
      if (team.id === msg.team_id) return;
      const envoy = team.members.find((m) => m.envoy);
      if (!team.solved.has(msg.meta.key)) return;             // 우리도 못 푼 곳은 도울 수 없음
      if (team.finished && rand() < 0.5) return;               // 끝난 조는 반쯤 엔딩 편지 쓰느라 못 봄
      if (rand() > 0.75) return;                               // 자기 게임에 바빠서 놓침 (25%)
      const delay = 0.3 + rand() * 1.2;                        // 읽고 답 쓰는 데 0.3~1.5분
      setTimeout(async () => {
        const s = sosLog.find((x) => x.id === msg.id);
        if (s && s.helpedAt) return;                          // 이미 누가 도와줬으면 겹치지 않게
        try {
          await post(envoy, "help", HELP_TEXT[msg.meta.key], { to: msg.team_id, toTeam: msg.meta.team, key: msg.meta.key, sos: msg.id });
          stats[team.name].helpsSent++;
          if (s && !s.helpedAt) { s.helpedAt = Date.now(); s.helper = team.name; }
          log(`  🤝 ${team.name} 상생 대사 ${envoy.name} → ${msg.meta.team} (${msg.meta.key})`);
        } catch (e) { log("  도와주기 실패", e.message); }
      }, delay * G);
    });
  }

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
      let asked = null, hinted = false;
      const el = () => gmin(Date.now() - start);
      while (el() < need) {
        await sleepG(0.4 + rand() * 0.3);
        // 조원 여러 명이 동시에 퍼즐 판을 만짐 (서로 다른 칸)
        const movers = team.members.filter(() => rand() < 0.4);
        await Promise.all(movers.map((m) => {
          team.local.moves[m.idx] = (team.local.moves[m.idx] || 0) + 1;
          return apply(team, m, [{ op: "set", p: ["puzzle", sp.key, "m" + m.idx], v: team.local.moves[m.idx] }]).catch(() => {});
        }));
        if (rand() < 0.35) post(any(), "team", pick(TALK[sp.key])).catch(() => {});
        // 막힘: 3.5분이 지나도 못 풀면 SOS(60%) 또는 힌트
        if (!asked && !hinted && el() > 3.5 && need - el() > 0.8) {
          if (rand() < 0.6) {
            const toHost = !teams.some((o) => o !== team && o.solved.has(sp.key)); // 앞선 조가 없으면 진행자에게
            const r = await post(any(), "sos", "막혔어요. 생각할 방향을 알려 주세요!", { key: sp.key, toHost }).then(() => true).catch(() => false);
            if (r) {
              await sleep(300);
              const mine = (await select(`messages?session_id=eq.${sess.id}&scope=eq.sos&team_id=eq.${team.id}&order=id.desc&limit=1`))[0];
              asked = { id: mine.id, at: Date.now(), toHost, hostIn: 1 + rand() };
              sosLog.push({ id: mine.id, team: team.name, key: sp.key, at: Date.now(), toHost });
              S.sos++;
              log(`🆘 ${team.name} ${sp.label}에서 SOS`);
            }
          } else {
            hinted = true;
            await takeHint(team, sp, S);
            need = el() + (need - el()) * 0.7;
          }
        }
        if (asked && !asked.done) {
          const help = inbox.find((x) => x.scope === "help" && x.meta.sos == asked.id);
          if (!help && asked.toHost && gmin(Date.now() - asked.at) > asked.hostIn) { // 진행자가 와서 방향을 알려 줌
            asked.done = true;
            const s = sosLog.find((x) => x.id === asked.id); s.helpedAt = Date.now(); s.helper = "진행자"; s.outcome = "진행자 도움";
            need = el() + (need - el()) * 0.55;
            log(`   🧑‍🏫 진행자가 ${team.name}를 도움 (${sp.label})`);
          } else if (help) {
            asked.done = true;
            const thanker = any();
            await rpc("thank_help", { p_player: thanker.pid, p_secret: thanker.secret, p_msg: help.id }).catch(() => {});
            S.sosHelped++;
            const s = sosLog.find((x) => x.id === asked.id); s.thanked = true; s.outcome = "도움 받음";
            need = el() + (need - el()) * 0.55;               // 방향을 알게 돼서 남은 시간 45% 줄어듦
            log(`   👍 ${team.name}이 ${help.meta.team}에게 '도움 됐어요'`);
          } else if (gmin(Date.now() - asked.at) > 2.5) {    // 2.5분 기다려도 없으면 힌트
            asked.done = true;
            const s = sosLog.find((x) => x.id === asked.id); s.outcome = "답 없어 힌트";
            if (!hinted) { hinted = true; await takeHint(team, sp, S); need = el() + (need - el()) * 0.7; }
          }
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
  setTimeout(() => rpc("host_post", { p_session: sess.id, p_key: sess.host_key, p_body: "막힌 조는 힌트 창에서 SOS를 보내 보세요. 도와준 조는 −30초!" }), 12 * G);

  await Promise.all(teams.map(playTeam));
  await sleepG(2.5);
  stop = true;

  /* ── 결과 ── */
  const rows = await select(`teams?session_id=eq.${sess.id}&select=id,name,state,ver,help_count,bonus,thanks`);
  const firsts = {};
  rows.forEach((t) => Object.entries(t.state.clearedAt || {}).forEach(([k, at]) => { if (!firsts[k] || at < firsts[k].at) firsts[k] = { at, team: t.name }; }));
  const result = rows.map((t) => {
    const s = t.state, raw = gmin(s.end - s.start);
    const score = raw + (s.penalty || 0) / 60 - (t.bonus || 0) / 60; // 벌점·보너스 60초 = 게임 1분
    return { t, s, raw, score, medals: Object.values(firsts).filter((f) => f.team === t.name).length };
  }).sort((a, b) => a.score - b.score);

  const team = (n) => teams.find((x) => x.name === n);
  console.log("\n════════ 결과 (게임 분 기준) ════════");
  console.log("순위  조          걸린시간  벌점   상생보너스  최종기록  첫탈출메달  힌트  SOS(받음)  도와줌(고마워요)");
  result.forEach((r, i) => {
    const S = stats[r.t.name];
    console.log(`${i + 1}위   ${r.t.name.padEnd(8)}  ${r.raw.toFixed(1).padStart(6)}분  +${((r.s.penalty || 0) / 60).toFixed(0)}분  −${((r.t.bonus || 0) / 60).toFixed(1)}분      ${r.score.toFixed(1).padStart(6)}분  ${String(r.medals).padStart(6)}개    ${String(r.s.hintsUsed || 0).padStart(3)}   ${S.sos}(${S.sosHelped})       ${r.t.help_count}(${r.t.thanks})`);
  });
  const answered = sosLog.filter((s) => s.helpedAt);
  console.log(`\nSOS ${sosLog.length}건 중 도움 받음 ${answered.length}건 (${sosLog.length ? Math.round((answered.length / sosLog.length) * 100) : 0}%)`);
  if (answered.length) console.log(`도움이 오기까지 평균 ${(answered.reduce((a, s) => a + gmin(s.helpedAt - s.at), 0) / answered.length).toFixed(1)}분`);
  sosLog.forEach((s) => console.log(`  - ${s.team} ${s.key}: ${s.helpedAt ? `${s.helper}가 ${gmin(s.helpedAt - s.at).toFixed(1)}분 만에 도움` : "아무도 못 도움"} → ${s.outcome || "진행 중 해결"}`));

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
