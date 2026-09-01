import type { CultureLoungeItem, LoungeSourceRef } from "@/lib/lounge/loungeTypes";

const checked = (label: string, url: string): LoungeSourceRef[] => [
  { label, url, checked_at: "2026-09-01" },
];

const SOURCE_CHUNYUN = checked(
  "중국정부망·신화사 · 춘윈과 춘절 귀성·단란 맥락",
  "https://www.gov.cn/xinwen/2019-02/03/content_5363696.htm",
);
const SOURCE_REUNION_DINNER = checked(
  "전국철학사회과학공작판공실 · 춘절과 연야반의 가족 단란 의미",
  "https://www.nopss.gov.cn/n1/2025/0121/c459958-40406332.html",
);
const SOURCE_GOLDEN_WEEK = checked(
  "중국 문화여유부 · 국경절 황금연휴와 휴가·여행 문화",
  "https://www.mct.gov.cn/whzx/whyw/201910/t20191012_847206.htm",
);
const SOURCE_RED_PACKET = checked(
  "Tencent · 위챗 홍바오와 拼手气红包의 관계적 사용 기록",
  "https://static.www.tencent.com/uploads/2019/12/18/d4636c200fa8b9ba2eaafddd5f421b0b.pdf",
);
const SOURCE_GAOKAO = checked(
  "중국 교육부 · 보통고등학교 학생모집 전국통일시험(高考) 개요",
  "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/201610/W020161014527491551266.pdf",
);
const SOURCE_SQUARE_DANCE = checked(
  "중국 국가체육총국 · 광장무와 대중 생활체육 문화",
  "https://www.sport.gov.cn/n20001280/n20001265/n20067706/c27177866/content.html",
);
const SOURCE_TIME_HONORED = checked(
  "중국 상무부 등 8개 부처 · 老字号의 역사·기술·문화적 정의",
  "https://www.mofcom.gov.cn/zwgk/zcfb/art/2022/art_1be452ec00b64d6797860b2b14a9413f.html",
);
const SOURCE_GUOCHAO = checked(
  "중국 국가발전개혁위원회 · 국조와 전통문화의 현대적 소비",
  "https://www.ndrc.gov.cn/fggz/jyysr/jysrsbxf/202202/t20220222_1316109_ext.html",
);
const SOURCE_MORNING_TEA = checked(
  "광저우시 사법국 · 광저우 조차의 링난 사교·음식 관습",
  "https://sfj.gz.gov.cn/xxgk/xxgkml/gzdt/sfyw/content/post_10268174.html",
);
const SOURCE_NEIJUAN = checked(
  "중국대학생온라인 · 2020년 유행어의 内卷 해설",
  "https://dxs.moe.gov.cn/zx/a/fdy_bjtj_xgxs/220405/1748679.shtml",
);

export const CULTURE_ITEMS: CultureLoungeItem[] = [
  {
    id: "culture-chunyun-homecoming",
    module: "culture",
    title: "春运, 왜 ‘봄철 운송’이 아닐까?",
    language_direction: "zh_ko",
    context: "춘절을 앞두고 고향행 표를 구하는 직장인의 말",
    source_text: "春运的票太难抢了，今年可能得提前走。",
    prompt: "단어 뜻보다 사회적 장면을 살린 번역은?",
    choices: [
      { id: "a", label: "춘절 귀성표 구하기가 너무 힘들어서 올해는 일찍 출발해야 할 것 같아." },
      { id: "b", label: "봄철 운송표가 어려워서 봄에 떠나야 할 것 같아." },
      { id: "c", label: "봄 운동 경기 표를 미리 사야 할 것 같아." },
    ],
    answer_id: "a",
    quick_point: "春运은 춘절 전후의 대규모 귀성 이동이에요.",
    verified_facts: [
      "春运은 춘절 전후의 대규모 이동을 가리킨다.",
      "교통 현상과 가족이 모이는 춘절의 의미가 함께 활성화된다.",
    ],
    cultural_context: "중국 전역의 대규모 귀성과 가족 단란이 한 단어에 묶인 사회문화적 명칭입니다.",
    translation_interpretation: "일상 대화에서는 ‘춘절 귀성’으로 기능을 풀고, 기사에서는 첫 등장에 春运을 병기할 수 있습니다.",
    source_refs: SOURCE_CHUNYUN,
    review_status: "source_checked",
  },
  {
    id: "culture-reunion-dinner",
    module: "culture",
    title: "年夜饭, 그냥 저녁일까?",
    language_direction: "zh_ko",
    context: "춘절 연휴 계획을 의논하는 가족 대화",
    source_text: "今年的年夜饭是在外面订，还是回家一起做？",
    prompt: "식사의 시점과 가족 행사를 함께 드러내는 번역은?",
    choices: [
      { id: "a", label: "올해 섣달그믐 가족 식사는 밖에서 예약할까, 집에서 같이 만들까?" },
      { id: "b", label: "올해 야간 식사는 밖에서 주문할까?" },
      { id: "c", label: "올해 매일 저녁은 집에서 만들까?" },
    ],
    answer_id: "a",
    quick_point: "年夜饭은 섣달그믐의 가족 식사예요.",
    verified_facts: [
      "年夜饭은 춘절 전날인 섣달그믐에 가족이 함께하는 식사를 가리킨다.",
      "지역별 음식은 달라도 가족의 단란과 새해의 길한 의미가 중심이다.",
    ],
    cultural_context: "한 끼의 메뉴보다 가족이 한자리에 모여 묵은해를 보내는 의례적 시간이 중요합니다.",
    translation_interpretation: "장면이 낯선 독자에게는 ‘섣달그믐 가족 식사’로 풀고, 문화 글에서는 年夜饭을 병기할 수 있습니다.",
    source_refs: SOURCE_REUNION_DINNER,
    review_status: "source_checked",
  },
  {
    id: "culture-golden-week",
    module: "culture",
    title: "黄金周, 황금빛 한 주?",
    language_direction: "zh_ko",
    context: "국경절 연휴 여행을 준비하는 친구의 말",
    source_text: "黄金周去哪儿都挤，不如提前两天出发。",
    prompt: "휴가 제도와 여행 장면을 가장 분명하게 옮기면?",
    choices: [
      { id: "a", label: "국경절 황금연휴에는 어디든 붐비니 이틀 일찍 출발하자." },
      { id: "b", label: "금값이 오르는 주에는 어디든 붐빈다." },
      { id: "c", label: "황금색으로 꾸민 주간에는 여행하지 말자." },
    ],
    answer_id: "a",
    quick_point: "黄金周는 국경절 같은 중국의 장기 연휴예요.",
    verified_facts: [
      "黄金周는 국경절 등 장기 연휴와 연결된 명칭이다.",
      "휴가 기간의 대규모 이동·관광·소비 장면과 함께 사용된다.",
    ],
    cultural_context: "공휴일 배열, 장거리 여행, 관광지 혼잡이 함께 떠오르는 휴가문화 명칭입니다.",
    translation_interpretation: "대화에서는 ‘국경절 황금연휴’처럼 어느 연휴인지 밝혀 주면 혼잡의 이유까지 전달됩니다.",
    source_refs: SOURCE_GOLDEN_WEEK,
    review_status: "source_checked",
  },
  {
    id: "culture-random-red-packet",
    module: "culture",
    title: "拼手气红包, 무슨 놀이일까?",
    language_direction: "zh_ko",
    context: "위챗 단체방에서 벌어진 일을 설명하는 친구",
    source_text: "老板在群里发了个拼手气红包，大家一下都活跃了。",
    prompt: "모바일 기능과 단체방 분위기를 함께 전달하는 번역은?",
    choices: [
      { id: "a", label: "사장님이 단톡방에 금액이 랜덤으로 나뉘는 홍바오를 뿌리자 다들 활발해졌다." },
      { id: "b", label: "사장님이 운을 조립한 빨간 봉투를 우편으로 보냈다." },
      { id: "c", label: "사장님이 모두에게 같은 월급을 보냈다." },
    ],
    answer_id: "a",
    quick_point: "拼手气红包는 금액이 무작위로 나뉘는 홍바오예요.",
    verified_facts: [
      "홍바오는 명절에 주고받는 붉은 봉투의 관습과 연결된다.",
      "拼手气红包는 단체방 참여자가 무작위로 나뉜 금액을 받는 모바일 기능이다.",
    ],
    cultural_context: "전통적 홍바오가 모바일 결제와 단체 채팅의 관계적 놀이로 재구성된 사례입니다.",
    translation_interpretation: "‘홍바오’를 남기고 ‘금액이 랜덤으로 나뉘는’ 기능을 짧게 덧붙이면 장면이 살아납니다.",
    source_refs: SOURCE_RED_PACKET,
    review_status: "source_checked",
  },
  {
    id: "culture-gaokao-family",
    module: "culture",
    title: "高考, 시험 하나보다 큰 장면",
    language_direction: "zh_ko",
    context: "수험생이 있는 집의 요즘 분위기를 설명하는 친척",
    source_text: "孩子明年高考，全家最近都围着他的作息转。",
    prompt: "시험의 성격과 가족 분위기를 함께 드러내는 번역은?",
    choices: [
      { id: "a", label: "아이가 내년에 중국 대학입시인 가오카오를 치러서 온 가족이 생활 리듬을 맞추고 있어요." },
      { id: "b", label: "아이가 내년에 높은 시험을 봐서 가족이 빙빙 돌아요." },
      { id: "c", label: "아이가 내년에 학교 시험을 한 번 봐요." },
    ],
    answer_id: "a",
    quick_point: "高考는 중국의 전국 단위 대학입시예요.",
    verified_facts: [
      "高考는 보통고등학교 학생모집 전국통일시험을 가리킨다.",
      "대학 진학과 연결된 전국 규모의 시험이라는 제도적 맥락이 있다.",
    ],
    cultural_context: "시험 당사자뿐 아니라 가족의 일정과 지역사회의 관심까지 집중되는 교육문화 장면입니다.",
    translation_interpretation: "첫 등장에 ‘중국 대학입시인 가오카오’로 풀면 제도와 현지 명칭을 함께 보존할 수 있습니다.",
    source_refs: SOURCE_GAOKAO,
    review_status: "source_checked",
  },
  {
    id: "culture-square-dance",
    module: "culture",
    title: "广场舞, 춤보다 넓은 문화",
    language_direction: "zh_ko",
    context: "저녁 시간 아파트 단지 풍경을 말하는 주민",
    source_text: "小区广场晚上又开始跳广场舞了。",
    prompt: "공간과 참여 방식을 함께 보여 주는 번역은?",
    choices: [
      { id: "a", label: "저녁이 되니 아파트 단지 광장에서 주민들의 단체 건강춤이 다시 시작됐다." },
      { id: "b", label: "저녁에 극장 광장에서 무용 공연이 개막했다." },
      { id: "c", label: "저녁에 혼자 광장을 뛰기 시작했다." },
    ],
    answer_id: "a",
    quick_point: "广场舞는 공공장소에서 함께 즐기는 생활체육이에요.",
    verified_facts: [
      "广场舞는 대중이 야외 공간에서 함께하는 문화체육 활동이다.",
      "생활체육과 여가·교류의 기능을 함께 갖는 대중문화 현상으로 다뤄진다.",
    ],
    cultural_context: "전문 무용 공연보다 지역 주민의 반복적 생활체육과 사회적 만남에 가까운 장면입니다.",
    translation_interpretation: "문맥에 따라 ‘광장무’를 병기하거나 ‘주민 단체 건강춤’처럼 기능을 풀 수 있습니다.",
    source_refs: SOURCE_SQUARE_DANCE,
    review_status: "source_checked",
  },
  {
    id: "culture-time-honored-brand",
    module: "culture",
    title: "老字号, 오래된 번호?",
    language_direction: "zh_ko",
    context: "여행지의 유명 상점을 소개하는 현지인",
    source_text: "这家老字号开了上百年，外地人也专门来买。",
    prompt: "역사와 브랜드 신뢰를 함께 살린 번역은?",
    choices: [
      { id: "a", label: "이 유서 깊은 전통 브랜드는 백 년 넘게 이어져 외지인도 일부러 찾아와요." },
      { id: "b", label: "이 늙은 번호는 백 년 넘게 문을 열었어요." },
      { id: "c", label: "이 낡은 가게는 손님이 거의 없어요." },
    ],
    answer_id: "a",
    quick_point: "老字号는 역사와 기술을 이어 온 전통 브랜드예요.",
    verified_facts: [
      "老字号는 오랜 역사와 전승된 제품·기술·서비스를 가진 브랜드를 가리킨다.",
      "사회적 인지도와 전통문화의 특색이 함께 강조된다.",
    ],
    cultural_context: "영업 연수만 긴 가게가 아니라 기술·명성·문화적 계보가 축적된 브랜드 범주입니다.",
    translation_interpretation: "‘유서 깊은 전통 브랜드’로 풀면 단순히 낡았다는 오해를 줄일 수 있습니다.",
    source_refs: SOURCE_TIME_HONORED,
    review_status: "source_checked",
  },
  {
    id: "culture-guochao-design",
    module: "culture",
    title: "国潮, 국산품만 뜻할까?",
    language_direction: "zh_ko",
    context: "전통 문양을 활용한 신제품을 평가하는 디자이너",
    source_text: "这个联名很国潮，传统纹样做得很现代。",
    prompt: "전통과 현대적 소비 감각을 함께 살린 번역은?",
    choices: [
      { id: "a", label: "이번 협업은 중국 전통 요소를 현대적으로 살린 ‘국조’ 감성이 강해요." },
      { id: "b", label: "이번 협업은 국가의 조수처럼 보입니다." },
      { id: "c", label: "이번 협업은 전통 요소를 모두 없앴어요." },
    ],
    answer_id: "a",
    quick_point: "国潮는 전통 요소를 현대적으로 즐기는 흐름이에요.",
    verified_facts: [
      "国潮는 중국 전통문화 요소와 현대적 유행·소비를 결합하는 흐름과 연결된다.",
      "제품의 기능뿐 아니라 문화적 정체성과 감정적 가치가 함께 강조된다.",
    ],
    cultural_context: "전통 문양을 복제하는 데 그치지 않고 현대 디자인과 자국 문화 소비가 만나는 흐름입니다.",
    translation_interpretation: "문화 설명에서는 ‘국조(중국식 뉴트로·문화 트렌드)’처럼 원어와 기능을 함께 제시할 수 있습니다.",
    source_refs: SOURCE_GUOCHAO,
    review_status: "source_checked",
  },
  {
    id: "culture-guangzhou-morning-tea",
    module: "culture",
    title: "叹早茶, 차 한 잔이면 끝?",
    language_direction: "zh_ko",
    context: "광저우의 주말 가족 일정을 말하는 친구",
    source_text: "周末带爷爷奶奶去叹早茶，一坐就是一上午。",
    prompt: "광둥 지역의 식사·사교 장면을 살린 번역은?",
    choices: [
      { id: "a", label: "주말에는 조부모님을 모시고 광둥식 아침 차와 딤섬을 즐기며 오전을 보내요." },
      { id: "b", label: "주말에는 조부모님과 차를 한 모금 마시고 바로 나와요." },
      { id: "c", label: "주말에는 아침마다 차가 식었다고 한숨 쉬어요." },
    ],
    answer_id: "a",
    quick_point: "叹早茶는 차·딤섬·대화를 즐기는 광둥 문화예요.",
    verified_facts: [
      "광저우 조차는 링난 지역의 독특한 사교·음식 관습으로 설명된다.",
      "차와 딤섬을 함께 즐기며 가족·친구와 오래 대화하는 생활문화가 포함된다.",
    ],
    cultural_context: "‘아침 차’라는 음료보다 차루에서 먹고 이야기하며 관계를 이어 가는 시간이 중심입니다.",
    translation_interpretation: "‘광둥식 아침 차와 딤섬을 즐기다’로 풀면 음식과 사교 기능을 함께 전달할 수 있습니다.",
    source_refs: SOURCE_MORNING_TEA,
    review_status: "source_checked",
  },
  {
    id: "culture-neijuan-competition",
    module: "culture",
    title: "内卷, 왜 ‘말다’가 아닐까?",
    language_direction: "zh_ko",
    context: "불필요하게 야근 경쟁이 붙은 상황을 말하는 동료",
    source_text: "别卷了，这个项目没必要人人都熬夜。",
    prompt: "이 장면의 사회현상을 가장 분명하게 드러내면?",
    choices: [
      { id: "a", label: "그만 소모적인 과열 경쟁해. 이 프로젝트 때문에 모두가 야근할 필요는 없어." },
      { id: "b", label: "종이를 그만 말아. 프로젝트가 구겨지겠어." },
      { id: "c", label: "경쟁을 더 세게 해서 모두 야근하자." },
    ],
    answer_id: "a",
    quick_point: "内卷은 서로를 몰아붙이는 소모적 경쟁이에요.",
    verified_facts: [
      "内卷은 2020년 중국의 유행어로 선정됐다.",
      "발전 없이 반복되는 노력이나 비합리적인 내부 경쟁을 비판하는 의미로 확장됐다.",
    ],
    cultural_context: "교육·직장 등에서 성과 증가 없이 서로를 몰아붙이는 경쟁을 비판하는 사회 담론입니다.",
    translation_interpretation: "대화에서는 ‘소모적 과열 경쟁’으로 풀고, 사회현상 글에서는 内卷을 병기할 수 있습니다.",
    source_refs: SOURCE_NEIJUAN,
    review_status: "source_checked",
  },
];
