/*
 * 게임 콘텐츠 파일
 * - 퍼즐 문구, 정답, 힌트, 등장인물, 안내 팝업을 여기서만 고치면 됩니다.
 * - 줄바꿈 규칙: 문장 안의 "\n"은 의미 단위 줄바꿈입니다. 아무 데서나 끊기지 않게 직접 끊어 주세요.
 * - 자물쇠 정답은 해시값(hash)으로 저장합니다. 정답을 바꾸려면 node tools/hash.js 새정답
 * - 사실 정보 출처: cj.co.kr, cj.net (2026-11-04 확인)
 */
window.GAME = {
  meta: {
    title: "ONLYONE 레시피를 찾아라",
    subtitle: "햇반 30주년 타임캡슐",
    disclaimer:
      "이 게임은 CJ제일제당 입사 지원자가 온보딩 프로그램 제안용으로 만든 비공식 포트폴리오입니다.\n" +
      "로고·브랜드·사진의 권리는 CJ제일제당에 있으며 출처는 cj.co.kr, cj.net입니다.\n" +
      "등장인물과 선배 메시지는 모두 가상으로 지어낸 내용입니다."
  },

  /* 시작 화면: 끌어서 30년 건너기 (왼쪽 1996 → 오른쪽 2026) */
  intro: {
    then: { img: "assets/history/1996_hetbahn.jpg", alt: "1996년 햇반 출시 당시 매장" },
    now: { img: "assets/photo/hetbahn_2026_banner.png", alt: "2026년 오늘, 햇반 생산 라인" },
    beats: [
      { until: 0.12, lines: ["1996년, 햇반이 처음 나온 날", "「ONLYONE 레시피북」을 타임캡슐에 묻었어요."] },
      { until: 0.97, lines: ["캡슐이 땅속에 잠든 동안", "비비고 같은 새 맛이 나왔어요."] },
      { until: 1.01, lines: ["그리고 2026년 오늘,", "30년 만에 캡슐을 엽니다."] }
    ],
    yearNotes: { 1996: "햇반이 처음 나온 해", 2010: "비비고가 나온 해", 2026: "햇반 30주년, 오늘" },
    punch: "캡슐을 열었는데, <b>레시피북이 없어요.</b>",
    go: "1953년부터 추적하기"
  },

  /* 말풍선 화자 */
  speakers: {
    "블라썸": { emoji: "ti-sparkles", kind: "ai" },
    "한햇님": { emoji: "ti-bowl", kind: "person" }
  },

  /* ───────── 안내 팝업 (가운데 정렬, 줄 길이 차이 30% 이내) ───────── */
  guides: {
    rules: {
      cards: [
        { icon: "ti-users", title: "조원과 함께 접속", lines: ["같은 입장 코드, 같은 조 이름으로!", "퍼즐과 장면이 조원 화면에 같이 움직여요."] },
        { icon: "ti-puzzle", title: "단서는 나눠서", lines: ["단서가 조원마다 나뉘어요.", "한 장이라도 빠지면 답이 안 나와요."] },
        { icon: "ti-messages", title: "말로 맞춰 보기", lines: ["정답은 어디에도 그대로 없어요.", "단서를 합쳐서 추리해야 열려요."] },
        { icon: "ti-bulb", title: "막히면 힌트", lines: ["힌트는 조 기록에 +1·3·5분이 더해져요.", "힌트 없이 풀면 생각왕에 가까워져요."] }
      ],
      done: "게임 시작"
    },
    coach: [
      { target: ".objects", text: "점선 버튼에 단서가 숨어 있어요." },
      { target: "#puzzle", text: "퍼즐을 풀면 비밀번호 실마리가 나와요." },
      { target: "#lockbox", text: "비밀번호를 넣으면 다음 방이 열려요." },
      { target: ".hud", text: "시간은 계속 흘러요. 막히면 힌트 버튼!" }
    ],
    acts: {
      act1: { icon: "ti-door", title: "방 5개를 탈출하세요", lines: ["단서가 조원에게 나뉘어 있어요.", "내 단서를 말로 공유하세요.", "목표 시간은 약 30분이에요."] },
      act2: { icon: "ti-search", title: "범인을 찾으세요", lines: ["증언 5개와 출입 기록을 비교하세요.", "기록과 출입증 목록은 다른 조원에게 있어요.", "조원 과반이 같은 사람을 골라야 확정!"] },
      act3: { icon: "ti-lock", title: "셋이 함께 여세요", lines: ["역할은 입장한 순서대로 정해져요.", "내 단서를 말로 설명해 주세요.", "잠금장치는 모두 3개예요."] }
    },
    roleRule: { icon: "ti-eye-off", title: "내 화면은 나만 봐요", lines: ["화면은 보여주지 말고 말로만!", "잘 설명하는 것도 실력이에요."] },
    stuck: ["이 방에서 7분이 지났어요.", "힌트 1은 1분만 더해져요."],
    demos: {
      frames:   { kind: "drag",    text: "액자를 끌어서 벽에 거세요." },
      scratch:  { kind: "scrub",   text: "지우개로 문질러 보세요." },
      basket:   { kind: "drag",    text: "재료를 바구니에 담으세요." },
      dial:     { kind: "dial",    text: "다이얼을 위아래로 돌리세요." },
      accuse:   { kind: "hold",    text: "길게 눌러서 지목하세요." },
      pins:     { kind: "tap",     text: "핀 2개를 순서대로 누르세요." },
      pieces:   { kind: "drag",    text: "조각을 빈칸에 끼우세요." },
      alarm:    { kind: "hold",    text: "버튼을 길게 눌러 경보를 끄세요." },
      drop:     { kind: "drag",    text: "편지를 캡슐로 끌어 넣으세요." }
    }
  },

  prologue: [
    "2026년 11월, CJ제일제당센터.\n햇반 30주년 타임캡슐을 여는 날이에요.",
    "1996년에 묻은 캡슐을\n30년 만에 열었는데,\n<b>「ONLYONE 레시피북」</b>이 없어요.",
    { who: "블라썸", text: "레시피북이 사라졌습니다.\n찾을 때까지 센터를 봉쇄합니다." },
    { who: "블라썸", text: "걱정 마세요, 신입님.\n레시피북의 첫 장, 1953년부터\n차근차근 따라가면 단서가 나올 거예요." },
    { who: "블라썸", text: "먼저 경보부터 꺼 볼까요?" }
  ],
  alarmOff: "경보가 꺼졌어요.\n하지만 문은 아직 잠겨 있어요!",

  hintPenalty: [60, 180, 300],
  lockout: { tries: 5, seconds: 30 },

  /* 방 단서(objects): shared가 있으면 모두에게, 없으면 조원에게 하나씩 나뉜다.
   * 방마다 나뉘는 단서는 5장. 한 장이라도 빠지면 답이 하나로 정해지지 않게 만들었다. */
  rooms: [
    /* ───────── 방 1: 연도 계산 사슬 ───────── */
    {
      id: "room1",
      no: 1,
      title: "로비 「1953 설탕 공장」",
      theme: "70년의 역사",
      intro: "로비 벽면의 역사 갤러리.\n경보 진동에 액자 7개가\n바닥으로 떨어져 뒤섞였어요.\n벽의 고리에는 연도만,\n액자에는 사건만 남아 있어요.",
      objects: [
        {
          shared: true,
          icon: "ti-photo",
          label: "벽에 남은 안내문",
          title: "역사 갤러리 안내문",
          body:
            "<p>CJ제일제당은 1953년,\n<b>대한민국 최초의 설탕 제조업</b>으로\n첫발을 내디뎠어요.</p>" +
            "<p class='note'>액자를 <b>사건이 일어난 해의 고리</b>에\n다시 걸면 뒷면의 글자가 보여요.\n금고 비밀번호는 그 <b>일곱 글자</b>예요.</p>"
        },
        { icon: "ti-grain", label: "제분 공장 메모", title: "제분 공장 메모",
          body: "<p class='memo'>제분 사업은 설탕 생산\n<b>5년 뒤</b>에 시작했어요.\n'백설'은 제분 <b>7년 뒤</b>에 나왔어요.</p>" },
        { icon: "ti-soup", label: "다시다 광고지", title: "다시다 광고지",
          body: "<p class='memo'>'다시다'는 '백설'이 나오고\n<b>10년 뒤</b>에 생산을 시작했어요.</p>" },
        { icon: "ti-bowl", label: "햇반 포스터", title: "햇반 30주년 포스터",
          body: "<p class='memo'>'햇반'은 '다시다'\n<b>21년 뒤</b>에 나왔어요.\n그리고 올해가 <b>30주년</b>이에요.</p>" },
        { icon: "ti-world", label: "비비고 보도자료", title: "비비고 보도자료",
          body: "<p class='memo'>'비비고'는 '햇반'\n<b>14년 뒤</b>에 나온\n글로벌 한식 브랜드예요.</p>" },
        { icon: "ti-building", label: "블로썸파크 초대장", title: "CJ블로썸파크 개관 초대장",
          body: "<p class='memo'>융복합 연구소 'CJ블로썸파크'는\n'비비고' <b>7년 뒤</b>에 문을 열었어요.</p>" }
      ],
      puzzle: {
        type: "timeline",
        demo: "frames",
        yearSlots: true,
        alt: "끌기가 어려우면 액자를 누르세요.\n빈 고리에 차례로 걸려요.",
        help: "조원 단서를 이어서 사건마다 연도를 계산하고,\n그 연도의 고리에 액자를 거세요.",
        cards: [
          { year: "1953", text: "제일제당공업주식회사 설립,\n국내 최초 설탕 생산", letter: "O", img: "assets/history/1953_factory.jpg" },
          { year: "1958", text: "제분 사업 시작", letter: "N", emoji: "ti-grain" },
          { year: "1965", text: "식품 대표 브랜드\n'백설' 출시", letter: "L", img: "assets/history/1965_sugar.jpg" },
          { year: "1975", text: "종합 조미료\n'다시다' 생산 개시", letter: "Y", img: "assets/history/1975_dasida.jpg" },
          { year: "1996", text: "한국 최초 즉석밥\n'햇반' 출시", letter: "O", img: "assets/history/1996_hetbahn.jpg" },
          { year: "2010", text: "글로벌 한식 브랜드\n'비비고' 출시", letter: "N", img: "assets/brands/bibigo.png" },
          { year: "2017", text: "융복합 연구소\n'CJ블로썸파크' 개관", letter: "E", img: "assets/ci/blossompark.jpg" }
        ],
        doneText: "액자가 뒤집히며\n뒷면의 글자가 나타났어요.\n70년 넘게 쌓아 온 성장의 DNA예요."
      },
      lock: { prompt: "금고 비밀번호 (영문 7자)", hash: "f0178e35", placeholder: "예: ABCDEFG" },
      hints: [
        "1953년에서 출발해서\n조원 단서의 '○년 뒤'를\n차례로 더해 보세요.",
        "제분 1958 → 백설 1965 → 다시다 1975\n→ 햇반 1996 → 비비고 2010\n→ 블로썸파크 2017",
        "정답은 ONLYONE이에요."
      ],
      reward: { id: "onlyone", label: "열쇠 단어 ONLYONE", icon: "ti-key" },
      outro: { who: "블라썸", text: "ONLYONE은 CJ의 경영철학이에요.\n최초·최고·차별화를 추구한다는 뜻이죠.\n나중에 또 필요하니 꼭 기억해 두세요!" }
    },

    /* ───────── 방 2: 이해관계자 딜레마 ───────── */
    {
      id: "room2",
      no: 2,
      title: "회의실 「ONLYONE 회의」",
      theme: "미션 · 행동원칙",
      intro: "긴급 회의실.\n내일 나갈 신제품 포장에서\n알레르기 표시가 빠진 걸 발견했어요.\n부서마다 남긴 메모를 모아\n결정을 내려야 해요.",
      objects: [
        {
          shared: true,
          icon: "ti-presentation",
          label: "화이트보드",
          title: "화이트보드",
          body:
            "<p class='board'>MISSION<br><b>ONLYONE 제품과 서비스로<br>최고의 가치를 창출하여<br>▢▢ ▢▢에 기여한다</b></p>" +
            "<p class='board small'>VISION<br>건강, 즐거움, 편리를 창조하는<br>글로벌 생활문화기업</p>"
        },
        {
          shared: true,
          icon: "ti-file-text",
          label: "벽에 걸린 액자",
          title: "창업 정신",
          body:
            "<p>1953년, CJ제일제당은\n<b>사업보국(事業報國)</b>의 일념으로\n출발했어요.</p>" +
            "<p class='note'>사업보국: 사업을 통해\n나라와 사회에 보답한다는 뜻</p>"
        },
        { icon: "ti-shield-check", label: "품질안전팀 메모", title: "품질안전팀 메모",
          body: "<p class='memo'>표시가 빠진 제품은\n<b>한 개도</b> 매장에 나가면 안 돼요.</p>" },
        { icon: "ti-building-factory-2", label: "생산팀 메모", title: "생산팀 메모",
          body: "<p class='memo'>새 포장으로 다시 만들면 <b>2주</b>,\n보완 스티커를 붙이면 <b>2일</b> 걸려요.</p>" },
        { icon: "ti-mail", label: "협력사 메일", title: "협력사(마트) 메일",
          body: "<p class='memo'>마트 행사가 <b>일주일 뒤</b> 시작해요.\n그 안에 못 들어오면\n행사 자리가 다른 회사로 넘어가요.</p>" },
        { icon: "ti-scale", label: "법무팀 메모", title: "법무팀 메모",
          body: "<p class='memo'>보완 스티커로 표시를 바로잡으면\n<b>판매해도 돼요.</b></p>" },
        { icon: "ti-user-check", label: "팀장 메모", title: "팀장 메모",
          body: "<p class='memo'>어떤 결정이든\n고객과 협력사가 <b>우리에게서 먼저</b>\n듣게 해 주세요.</p>" }
      ],
      puzzle: {
        type: "decision",
        demo: "scratch",
        help: "선택지마다 어긋나는 메모가 있는지\n조원과 하나씩 따져 보세요.\n모든 메모를 지키는 결정은 하나뿐이에요.",
        question: "출시 하루 전, 우리 팀의 결정은?",
        options: [
          { id: "A", text: "예정대로 출시하고,\n다음 생산분부터 라벨을 고친다.", breaks: "품질안전팀 메모" },
          { id: "B", text: "출시를 미루고,\n전량 새 포장으로 다시 만든다.", breaks: "생산팀 메모 · 협력사 메일" },
          { id: "C", text: "보완 스티커를 붙여 이틀 뒤 출시하고,\n고객과 협력사에 먼저 알린다." },
          { id: "D", text: "보완 스티커를 붙여 이틀 뒤 출시하되,\n문제는 따로 알리지 않는다.", breaks: "팀장 메모" }
        ],
        answer: "C",
        principles: [
          { name: "정직", why: "숨기지 않고 먼저 알렸어요" },
          { name: "존중", why: "협력사 행사 일정을 지켰어요" },
          { name: "창의", why: "스티커로 빠르게 바로잡았어요" },
          { name: "열정", why: "이틀 안에 끝까지 해결했어요" }
        ],
        scratchHidden: "ㄱ ▢ ㅅ ▢",
        doneText: "결정에 행동원칙 네 가지가 모두 담겼어요.\n이제 화이트보드의 지워진 미션을 볼 차례.\n지우개로 문질러 보세요."
      },
      lock: { prompt: "화이트보드 빈칸 네 글자", hash: "bc3b0880", placeholder: "예: ○○○○" },
      hints: [
        "선택지 하나씩, 어긋나는 메모가 있으면 지워 보세요.\n미션 빈칸은 '사업보국' 액자와 이어져 있어요.",
        "새 포장 2주는 행사 일주일보다 길어요.\n미션 빈칸은 '나라' 두 글자 + '사회' 두 글자.",
        "결정은 C, 자물쇠 정답은 '국가사회'예요."
      ],
      reward: null,
      outro: { who: "블라썸", text: "핵심가치는 인재·ONLYONE·상생,\n행동원칙은 정직·열정·창의·존중이에요.\n어려운 결정일수록 이 원칙이 기준이 돼요." }
    },

    /* ───────── 방 3: 조건 맞추기 ───────── */
    {
      id: "room3",
      no: 3,
      title: "K-Food 키친 「해외 바이어 환영 한 상」",
      theme: "대표 브랜드",
      intro: "시식 키친.\n오늘 해외 바이어가 와요.\n선반의 제품 9개 중 네 개로\n한 상을 차려야 하는데,\n조건이 조원마다 흩어져 있어요.",
      objects: [
        { icon: "ti-list-numbers", label: "셰프 코스표", title: "셰프 코스표",
          body: "<p class='memo'>순서는\n<b>밥 → 메인 → 국물 → 디저트.</b>\n칸마다 제품 하나씩.</p>" },
        { icon: "ti-mail", label: "바이어 메일", title: "바이어 메일",
          body: "<p class='memo'>미국에서 <b>만두로 1위</b>를 한\n그 브랜드를 메인으로\n꼭 맛보고 싶어요.</p>" },
        { icon: "ti-soup", label: "국물 담당 메모", title: "국물 담당 메모",
          body: "<p class='memo'>국물 맛은\n<b>장류가 아니라 조미료</b>로 내요.</p>" },
        { icon: "ti-cake", label: "디저트 담당 메모", title: "디저트 담당 메모",
          body: "<p class='memo'>디저트는 셰프가 직접 구워요.\n다 만들어진 디저트 말고\n<b>설탕</b> 브랜드로 주세요.</p>" },
        { icon: "ti-fridge", label: "냉장고 메모", title: "냉장고 메모",
          body: "<p class='memo'>냉장고 다이얼 =\n코스 순서대로 담은 제품의\n<b>선반 칸 번호</b> 네 자리.</p>" }
      ],
      puzzle: {
        type: "shelf",
        alt: "끌기가 어려우면 제품을 누르세요.\n'바구니에 담기' 버튼이 있어요.",
        help: "제품을 누르면 브랜드 이야기가 나와요.\n조건에 맞는 제품을 코스 순서대로\n바구니에 담으세요.",
        basketSize: 4,
        items: [
          { slot: 1, name: "다시다", img: "assets/brands/dasida.png", info: "1975년 생산을 시작한\n종합 조미료 브랜드.\n반세기 가까이\n한국의 국물 맛을 책임져 왔어요." },
          { slot: 2, name: "고메", img: "assets/brands/gourmet.png", info: "레스토랑 같은 맛을 집에서 즐기는\n프리미엄 가정간편식 브랜드예요." },
          { slot: 3, name: "햇반", img: "assets/brands/hetbahn.png", info: "1996년 출시된\n한국 최초의 즉석밥.\n2026년, 출시 30주년을 맞았어요." },
          { slot: 4, name: "스팸", img: "assets/brands/spam.png", info: "CJ제일제당이 국내에서 선보이는\n캔햄 브랜드예요.\n(SPAM®은 Hormel Foods의 등록상표)" },
          { slot: 5, name: "백설", img: "assets/brands/beksul.png", info: "1965년 출시된 식품 대표 브랜드.\n포대 설탕을 가정용 소포장으로 바꿔\n부엌 풍경을 바꿨어요." },
          { slot: 6, name: "해찬들", img: "assets/brands/haechandle.png", info: "고추장·된장 같은 장류 브랜드.\n2006년 CJ제일제당과 합병했어요." },
          { slot: 7, name: "비비고", img: "assets/brands/bibigo.png", info: "2010년 출시된 글로벌 한식 브랜드.\n2016년 美 만두 시장 1위,\n2020년 만두 매출 1조 원 돌파." },
          { slot: 8, name: "쁘띠첼", img: "assets/brands/petitzel.png", info: "새로운 디저트 문화를 만들어 가는\n디저트 브랜드예요." },
          { slot: 9, name: "맛밤", img: "assets/brands/matbam.png", info: "자연의 밤 그대로를 담은\n간식 브랜드예요." }
        ]
      },
      lock: { type: "dial", digits: 4, prompt: "냉장고 다이얼 자물쇠 (숫자 4자리)", hash: "7ad95a9d" },
      hints: [
        "코스 칸마다 후보를 먼저 적고,\n조건에 안 맞는 제품을 지워 보세요.\n제품을 누르면 소개가 나와요.",
        "밥은 햇반, 메인은 비비고,\n국물은 다시다, 디저트는 백설이에요.",
        "정답은 3715예요."
      ],
      reward: null,
      outro: { who: "블라썸", text: "선반의 브랜드는 일부일 뿐이에요.\nCJ제일제당에는\n20개가 넘는 식품·BIO 브랜드가 있어요." }
    },

    /* ───────── 방 4: 원인 추리 ───────── */
    {
      id: "room4",
      no: 4,
      title: "CJ블로썸파크 「발효 연구실」",
      theme: "사업 구조 · BIO",
      intro: "식품·바이오 융복합 연구소,\nCJ블로썸파크의 발효 연구실.\n밤사이 탱크 하나의 수율이 떨어졌는데,\n정전으로 수율 기록이 지워졌어요.",
      objects: [
        { icon: "ti-report-analytics", label: "운전 기록", title: "어젯밤 탱크 운전 기록",
          body: "<table class='tbl'><tr><th>탱크</th><th>온도</th><th>pH</th><th>발효 시간</th></tr>" +
            "<tr><td>⑤</td><td>33℃</td><td>6.8</td><td>46시간</td></tr>" +
            "<tr><td>⑥</td><td>30℃</td><td>7.1</td><td>40시간</td></tr>" +
            "<tr><td>⑦</td><td>31℃</td><td>7.3</td><td>50시간</td></tr>" +
            "<tr><td>⑧</td><td>34℃</td><td>6.9</td><td>38시간</td></tr></table>" +
            "<p class='note'>수치는 게임용 가상 값이에요.</p>" },
        { icon: "ti-calendar", label: "생산 일정표", title: "생산 일정표",
          body: "<p class='memo'>탱크 라벨이 떨어졌어요.\n<b>홀수 탱크는 라이신,\n짝수 탱크는 트립토판</b>을 만들어요.</p>" },
        { icon: "ti-clipboard-list", label: "라이신 기준표", title: "라이신 균주 기준표",
          body: "<p class='memo'>라이신 균주가 잘 자라는 조건\n온도 <b>30~34℃</b>\npH <b>6.5~7.5</b></p>" },
        { icon: "ti-clipboard-list", label: "트립토판 기준표", title: "트립토판 균주 기준표",
          body: "<p class='memo'>트립토판 균주가 잘 자라는 조건\n온도 <b>28~32℃</b>\npH <b>6.8~7.2</b></p>" },
        { icon: "ti-pin", label: "연구실 게시판", title: "연구실 게시판",
          body:
            "<p>CJ제일제당의 사업은\n세 부문으로 나뉘어요.</p>" +
            "<ul><li><b>라이프스타일 식품</b>\nK-Food 세계화, 새로운 식문화 창조</li>" +
            "<li><b>기술소재</b>\n발효 기술 기반 Taste·Nutrition·\nHealth & Wellness·생분해 소재</li>" +
            "<li><b>핵심소재</b>\n설탕·밀가루·식용유 같은 식품소재와\n동물영양(아미노산·그린 프로틴)</li></ul>" +
            "<p class='note'>발효 시간은 36~52시간이면 모두 정상.\n탱크 비밀번호 = <b>BIO + 문제 탱크 번호</b></p>" }
      ],
      puzzle: {
        type: "tanklog",
        help: "탱크마다 무엇을 만드는지, 기준 안인지\n조원과 따져서 표시해 보세요.\n표시는 조원 화면에 같이 보여요.",
        tanks: [5, 6, 7, 8],
        strains: ["라이신", "트립토판"],
        note: "CJ제일제당은 미생물 발효로\n라이신·트립토판 같은 아미노산을 만들어요.\n온도·pH 수치는 게임용 가상 값이에요."
      },
      lock: { prompt: "탱크 비밀번호 (BIO + 탱크 번호)", hash: "b58a1ceb", placeholder: "예: BIO0" },
      hints: [
        "먼저 탱크마다 무엇을 만드는지 정하고,\n그 균주의 기준표와 비교하세요.",
        "숫자가 커 보인다고 문제가 아니에요.\n트립토판 탱크(⑥, ⑧)의 온도를 보세요.",
        "문제 탱크는 ⑧, 정답은 BIO8이에요."
      ],
      reward: null,
      outro: { who: "블라썸", text: "자연에서 얻고 자연으로 돌려주는 기술,\n그게 CJ제일제당 BIO 사업의 철학이에요." }
    },

    /* ───────── 방 5: 회의 시간 잡기 ───────── */
    {
      id: "room5",
      no: 5,
      title: "라운지 「님 문화」",
      theme: "일하는 방식",
      intro: "사내 라운지.\n선배 세 분과 30분짜리\nOT 피드백 회의를 잡아야 해요.\n일정과 메신저가 조원마다 흩어져 있어요.",
      objects: [
        {
          shared: true,
          icon: "ti-coffee",
          label: "라운지 포스터",
          title: "라운지 포스터",
          body:
            "<p><b>CJ는 2000년,\n대기업 최초로 '님' 문화를 도입했어요.</b></p>" +
            "<p>직급 대신 이름 뒤에 '님'을 붙이면\n누구나 수평적으로 의견을 낼 수 있어요.</p>"
        },
        { icon: "ti-calendar", label: "민지님 일정표", title: "김민지님 오늘 오후 일정",
          body: "<p class='memo'>14:00~15:00 팀 회의\n16:30~17:00 보고</p>" },
        { icon: "ti-message-circle", label: "서준님 메신저", title: "박서준님 메신저",
          body: "<p class='memo'>민지님, 저 오늘 <b>3시 반까지 외근</b>이에요.\n돌아와서 정리하고 <b>4시부터</b> 괜찮아요!</p>" },
        { icon: "ti-message-circle", label: "현우님 메신저", title: "이현우님 메신저",
          body: "<p class='memo'>저는 <b>2시 반~3시 반 교육</b>이고,\n<b>5시부터</b> 해외 법인 화상회의예요.</p>" },
        { icon: "ti-door", label: "회의실 예약표", title: "회의실 예약표",
          body: "<p class='memo'>오늘 비어 있는 시간\n15:00~15:30\n16:00~16:30\n17:00~18:00</p>" },
        { icon: "ti-note", label: "신입 메모", title: "내 메모",
          body: "<p class='memo'>회의는 <b>30분</b>.\n세 분 모두, 회의실까지 되는 시간!\n문 옆 다이얼에 <b>시작 시각 네 자리</b>를 넣으면\n회의실이 예약돼요.</p>" }
      ],
      puzzle: {
        type: "schedule",
        help: "칸을 눌러 ○(가능) · ✕(안 됨)을 표시하세요.\n네 줄이 모두 ○인 칸을 찾으면 돼요.\n표시는 조원 화면에 같이 보여요.",
        rows: ["민지님", "서준님", "현우님", "회의실"],
        start: 14, end: 18
      },
      lock: { type: "dial", digits: 4, prompt: "회의실 다이얼 (시작 시각 네 자리)", hash: "c47ae4ae" },
      hints: [
        "사람마다 되는 시간을 먼저 표에 적어 보세요.\n서준님은 외근 뒤 정리 시간까지 필요해요.",
        "세 분이 모두 되는 시간은 4시~4시 반이에요.\n회의실도 비어 있나요?",
        "정답은 1600이에요."
      ],
      reward: null,
      outro: { who: "블라썸", text: "직급 대신 이름과 '님'으로,\n일정은 서로 맞춰서.\n라운지 문이 열렸어요!\n이제 대표실 앞으로 가 봐요." }
    }
  ],

  /* ───────── 2막 ───────── */
  act2: {
    title: "2막 「사라진 레시피북」",
    intro: "대표실 앞 복도에 도착했어요.",
    introSay: { who: "블라썸", text: "어젯밤 타임캡슐 보관함 근처에\n다섯 명이 있었어요.\n증언을 듣고 레시피북을 꺼낸 사람을\n찾아 주세요." },
    suspects: [
      { name: "김연구님", dept: "식품연구소", emoji: "ti-flask",
        testimony: "해외 소비자 입맛에 맞춘\n비비고 만두 신제품을 개발하고 있어요.\n어젯밤 8시부터 10시까지\n<b>블로썸파크</b> 시식 테스트실에서 패널 평가를 했어요.\n센터에는 오지도 않았어요." },
      { name: "박발효님", dept: "BIO연구소", emoji: "ti-dna",
        testimony: "미생물 발효로 아미노산을 만드는\n균주를 연구해요.\n발효 탱크는 밤에도 지켜봐야 해서\n어젯밤 내내 <b>블로썸파크</b>에 있었어요.\n김연구님 시식 테스트에서 만두도 하나 얻어먹었죠." },
      { name: "이글로벌님", dept: "글로벌 마케팅", emoji: "ti-world",
        testimony: "식품사업 해외 매출이 절반을 넘으면서\n해외 법인과 회의가 많아요.\n어젯밤 9시부터 11시까지 센터 회의실에서\n<b>미국 법인과 화상회의</b>를 했어요.\n녹화 기록도 있어요." },
      { name: "최안전님", dept: "품질안전", emoji: "ti-shield-check",
        testimony: "모든 제품이 안전하게 식탁에 오르도록\n품질을 점검해요.\n어젯밤 <b>9시 30분</b>에 순찰하다\n타임캡슐 보관함 앞을 지나갔는데,\n그때 이미 <b>캡슐 봉인이 뜯겨 있었어요</b>." },
      { name: "한햇님", dept: "햇반 30주년 TF", emoji: "ti-bowl",
        testimony: "저는 30주년 캡슐 개봉식을 준비하고 있어요.\n어젯밤엔 <b>8시 50분에 퇴근</b>했어요.\n캡슐이요? 전 손도 안 댔어요.\n정말이에요!" }
    ],
    evidence: {
      icon: "ti-device-cctv",
      label: "보안실 출입 기록",
      title: "어젯밤 보안실 출입 기록",
      note: "보안실 불이 꺼져 있어요.\n손전등으로 모니터를 비춰 보세요.",
      rows: [
        ["20:02", "블로썸파크 시식 테스트실 입실", "FR-12"],
        ["20:47", "센터 회의실 입실", "GM-07"],
        ["21:10", "타임캡슐 보관함 열림", "TF-30"],
        ["21:15", "센터 퇴실", "TF-30"],
        ["21:30", "보관함 구역 순찰", "QS-03"]
      ]
    },
    badges: {
      icon: "ti-id-badge-2",
      label: "출입증 목록",
      title: "출입증 번호 읽는 법",
      body: "<p>출입증 번호 앞 두 글자는 <b>부서</b>예요.</p>" +
        "<table class='tbl'><tr><th>앞 글자</th><th>부서</th></tr>" +
        "<tr><td>FR</td><td>식품연구소</td></tr><tr><td>BR</td><td>BIO연구소</td></tr>" +
        "<tr><td>GM</td><td>글로벌 마케팅</td></tr><tr><td>QS</td><td>품질안전</td></tr>" +
        "<tr><td>TF</td><td>햇반 30주년 TF</td></tr></table>"
    },
    culprit: 4,
    wrongText: "그분은 알리바이가 확실해요.\n증언과 출입 기록을 다시 비교해 보세요.\n(+1분)",
    twist: [
      { who: "한햇님", text: "들켰네요!\n8시 50분에 퇴근했다는 건\n거짓말이었어요. 죄송해요." },
      { who: "한햇님", text: "어젯밤 캡슐을 미리 열어\n레시피북을 꺼냈어요.\n<b>1996년 이후 30년 동안 나온\n새 레시피</b>를 이어 붙이려고요." },
      { who: "한햇님", text: "그리고 마지막 장은 비워 뒀어요.\n올해 입사한 신입분들이\n채울 자리거든요." },
      { who: "한햇님", text: "완성한 레시피북은\n<b>새 30주년 캡슐</b>에 넣어 뒀어요.\n그런데 잠금장치가 좀 특별해요." },
      { who: "한햇님", text: "<b>라이프스타일 식품, 기술소재, 핵심소재</b>\n세 부문이 힘을 합쳐야만 열려요." },
      { who: "블라썸", text: "한햇님이 메모를 남겼어요.\n메모에 적힌 단어는 <b>'건강'</b>.\n캡슐에서 쓰일 것 같아요." }
    ],
    reward: { id: "health", label: "단어 조각 '건강'", icon: "ti-puzzle" },
    hints: [
      "증언과 출입 기록의 시간이\n서로 맞지 않는 사람을 찾아보세요.",
      "TF는 햇반 30주년 TF예요.\n8시 50분에 퇴근했다는 사람이\n9시 15분에 퇴실했어요.",
      "레시피북을 꺼낸 사람은 한햇님이에요."
    ]
  },

  /* ───────── 3막 ───────── */
  act3: {
    title: "3막 「30주년 타임캡슐」",
    intro: "로비에 놓인 새 30주년 타임캡슐.\n잠금장치 3개가 레시피북을 지키고 있어요.\n단서는 사업부문마다 따로 보여요.\n셋이 역할을 나눠 말로 모으세요.",
    roles: {
      A: { name: "라이프스타일 식품", color: "#F39200", emoji: "ti-bowl-chopsticks" },
      B: { name: "기술소재", color: "#2D7FF9", emoji: "ti-flask-2" },
      C: { name: "핵심소재", color: "#1AA260", emoji: "ti-seeding" }
    },
    locks: [
      {
        title: "잠금장치 ① 「한 상 차림」",
        type: "dial",
        digits: 4,
        prompt: "다이얼 자물쇠 (숫자 4자리)",
        hash: "fa73f1e2",
        clues: {
          A: "<p>캡슐 뚜껑에 식탁 그림이 새겨져 있어요.\n왼쪽부터 이 순서로 놓여 있어요.</p>" +
             "<p class='big'>햇반 → 비비고 → 다시다 → 쁘띠첼</p>",
          B: "<p>브랜드 포장 색깔표 (게임용 가상 색)</p>" +
             "<table class='tbl'><tr><th>브랜드</th><th>색</th></tr>" +
             "<tr><td>햇반</td><td>🔴</td></tr><tr><td>고메</td><td>🟣</td></tr>" +
             "<tr><td>비비고</td><td>⚫</td></tr><tr><td>스팸</td><td>🔵</td></tr>" +
             "<tr><td>다시다</td><td>🟤</td></tr><tr><td>쁘띠첼</td><td>🟡</td></tr></table>",
          C: "<p>잠금장치 옆 변환표.\n잠금장치는 <b>숫자 4자리</b>예요.</p>" +
             "<table class='tbl'><tr><th>색</th><th>숫자</th></tr>" +
             "<tr><td>🔴</td><td>4</td></tr><tr><td>🟣</td><td>1</td></tr><tr><td>⚫</td><td>2</td></tr>" +
             "<tr><td>🔵</td><td>3</td></tr><tr><td>🟤</td><td>6</td></tr><tr><td>🟡</td><td>9</td></tr><tr><td>⚪</td><td>7</td></tr></table>"
        },
        hints: [
          "A가 본 순서대로 브랜드를\nB의 표에서 색으로,\n다시 C의 표에서 숫자로 바꾸세요.",
          "햇반 🔴, 비비고 ⚫, 다시다 🟤, 쁘띠첼 🟡",
          "정답은 4269예요."
        ],
        solvedText: "딸깍! 첫 번째 잠금장치가 풀렸어요."
      },
      {
        title: "잠금장치 ② 「글로벌 지도」",
        type: "pins",
        pins: 6,
        pick: 2,
        prompt: "핀 2개를 순서대로 누르세요",
        hash: "89e14a12",
        clues: {
          A: "<p>캡슐 옆면의 세계지도에\n번호가 붙은 핀 6개가 꽂혀 있어요.</p>" +
             "<p class='pins-clue'><span>① 🇻🇳</span><span>② 🇫🇷</span><span>③ 🇺🇸</span><span>④ 🇬🇧</span><span>⑤ 🇯🇵</span><span>⑥ 🇧🇷</span></p>",
          B: "<p>글로벌 연혁 카드\n(나라 이름만 있고 핀 번호는 없어요)</p>" +
             "<ul class='cards'><li>2017.08 브라질 셀렉타 인수\n(농축대두단백 업체)</li>" +
             "<li>2019.02 미국 냉동식품업체 슈완스 인수</li>" +
             "<li>2022.02 베트남 키즈나 공장 완공</li>" +
             "<li>2022.05 영국 법인 설립</li>" +
             "<li>2024.05 프랑스 법인 설립</li>" +
             "<li>2025.07 일본 치바 신공장 준공</li></ul>" +
             "<p class='note'>2025년 12월,\n식품사업 해외매출 비중이 50%를 넘었어요.</p>",
          C: "<p>잠금장치에 새겨진 지시문</p>" +
             "<p class='big'>\"가장 최근에 <b>공장을 지은</b> 나라의 핀,\n그다음 <b>가장 오래된 사건</b>의 나라 핀\"</p>"
        },
        hints: [
          "B의 카드에서 '공장'이 들어간 사건 중\n가장 최근 것을 찾고,\n그다음 가장 오래된 카드를 찾으세요.",
          "가장 최근 공장은 일본(2025),\n가장 오래된 사건은 브라질(2017)이에요.\nA의 핀 번호를 확인하세요.",
          "정답은 ⑤ → ⑥이에요."
        ],
        solvedText: "딸깍! 두 번째 잠금장치가 풀렸어요."
      },
      {
        title: "잠금장치 ③ 「비전」",
        type: "pieces",
        prompt: "단어 조각을 빈칸에 끼우세요",
        hash: "2b721272",
        before: "",
        after: "를 창조하는\n글로벌 생활문화기업",
        slots: 3,
        pieces: ["건강", "정직", "즐거움", "상생", "편리", "ONLYONE"],
        clues: {
          A: "<p>당신이 모은 아이템</p><p class='big'><i class='ti ti-key'></i> ONLYONE &nbsp; <i class='ti ti-puzzle'></i> 건강</p>",
          B: "<p>캡슐 바닥에 붙어 있던 단어 조각</p><p class='big'><i class='ti ti-puzzle'></i> 즐거움</p>",
          C: "<p>잠금장치 안쪽의 단어 조각과 규칙</p><p class='big'><i class='ti ti-puzzle'></i> 편리</p>" +
             "<p>\"CJ제일제당의 <b>비전</b>에 나오는 순서대로\n세 조각을 끼우시오.\n나머지 조각은 함정이다.\"</p>"
        },
        hints: [
          "비전은 회의실 화이트보드\n아래쪽에 있었어요.",
          "\"건강, 즐거움, 편리를 창조하는\n글로벌 생활문화기업\"",
          "건강 → 즐거움 → 편리 순서로 끼우세요."
        ],
        solvedText: "마지막 잠금장치가 풀렸어요!"
      }
    ]
  },

  /* ───────── 엔딩 ───────── */
  ending: {
    capsule: "<b>건강, 즐거움, 편리를 창조하는\n글로벌 생활문화기업</b>\n비전 문장이 완성되자\n캡슐 뚜껑이 살짝 들렸어요.",
    slideLabel: "밀어서 캡슐 열기",
    pages: [
      { year: "1953", title: "설탕 한 숟가락의 시작", lines: ["대한민국 최초의 설탕에서", "우리의 레시피가 시작됐어요."] },
      { year: "1996", title: "햇반이 나온 날", lines: ["이 레시피북은 그날", "타임캡슐에 묻혔어요."] },
      { year: "2010", title: "새로 붙인 페이지", lines: ["캡슐이 잠든 동안 나온 비비고", "한햇님이 30년 치를 이어 붙였어요."] },
      { year: "2026", title: "그리고, 마지막 장", lines: ["ONLYONE 레시피의 마지막 재료는", "지금 이 페이지를 읽고 있는", "<b>당신</b>입니다."], last: true }
    ],
    seniors: [
      { name: "정하늘님", role: "인사팀 · 10년 차", emoji: "",
        msg: "입사를 진심으로 환영해요!\n10년 동안 신입 동기들을 맞이하면서 느낀 건,\n처음 석 달은 모르는 게 당연하다는 거예요.\n모르는 걸 모른다고 말하는 것,\n그게 행동원칙 '정직'의 시작이에요.\n궁금한 건 언제든 '하늘님!' 하고 불러 주세요." },
      { name: "오세린님", role: "식품연구소 · 7년 차", emoji: "",
        msg: "제가 처음 개발에 참여한 만두가\n해외 마트 냉동고에 놓인 걸 봤을 때\n소름이 돋았어요.\n여러분의 작은 아이디어 하나가\n세계 어느 식탁에 오를지 몰라요.\n실패해도 괜찮으니 마음껏 시도해 보세요." },
      { name: "강도윤님", role: "BIO 영업 · 5년 차", emoji: "",
        msg: "BIO는 처음엔 어렵게 느껴질 수 있어요.\n저도 '라이신'이 뭔지 몰랐거든요.\n그런데 우리가 만든 아미노산이\n전 세계 농장과 식탁을 잇는다는 걸 알게 되면\n일이 정말 재미있어져요.\n같이 공부해요!" },
      { name: "윤채원님", role: "마케팅 · 3년 차", emoji: "",
        msg: "저도 3년 전 이 자리에 있었어요.\n지금 옆에 있는 동기들이\n앞으로 가장 든든한 힘이 될 거예요.\n오늘 함께 캡슐을 연 것처럼,\n앞으로도 서로의 단서가 되어 주세요." },
      { name: "햇반 30주년 TF 일동", role: "한햇님과 친구들", emoji: "",
        msg: "레시피북을 몰래 꺼내서 미안해요!\n30년 전 햇반도 처음엔\n'밥을 사 먹는다고?'라는 말을 들었대요.\n세상에 없던 것을 만드는 게 ONLYONE이에요.\n여러분이 만들 다음 30년이 정말 기대돼요." }
    ],
    letterPrompt: "이 레시피북은 다시 캡슐에 넣어\n2053년, 창립 100주년에 열어요.\n그날의 CJ제일제당에게 한 줄을 남겨 주세요.",
    letterDrop: "다 쓴 편지를 끌어서 캡슐에 넣어 주세요.\n편지를 눌러도 넣을 수 있어요.",
    certTitle: "ONLYONE 레시피 수료증"
  }
};
