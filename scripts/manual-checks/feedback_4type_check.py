# feedback-lite 4유형 수락 검수 (계약 0-r·108)
# ⓐ의미누락→meaning ⓑ문법붕괴→grammar ⓒ직접적→feature ⓓ적절→clear
import argparse
import json
from pathlib import Path
import urllib.request

env = {}
env_path = Path(__file__).resolve().parents[2] / ".env"
for line in env_path.read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.strip().split("=", 1)
        env[k] = v
URL = env["VITE_SUPABASE_URL"] + "/functions/v1/generate-scenario"
KEY = env["VITE_SUPABASE_PUBLISHABLE_KEY"]

parser = argparse.ArgumentParser()
parser.add_argument(
    "--mode",
    choices=("translation", "interpreting", "both"),
    default="translation",
    help="검증할 산출 모드(기본: translation)",
)
parser.add_argument(
    "--case",
    choices=("all", "meaning", "grammar", "feature", "clear"),
    default="all",
    help="반복 진단할 단일 분기(기본: all)",
)
parser.add_argument(
    "--repeat",
    type=int,
    default=1,
    help="선택한 검사를 반복할 횟수(기본: 1)",
)
args = parser.parse_args()
if args.repeat < 1:
    parser.error("--repeat는 1 이상이어야 합니다.")
MODES = ("translation", "interpreting") if args.mode == "both" else (args.mode,)

FEATURE = {
    "code": "request_mitigation_optionality",
    "learner_label": "완화와 선택권",
    "operational_definition": "요청이 상대에게 거절·조율의 여지를 얼마나 남기는가. 능원동사 완화·조건절 포석·선택권을 남기는 종결로 실현된다.",
    "band_schema": [
        {"code": "too_direct", "label_ko": "너무 직접적 (선택권을 남기지 않음)"},
        {"code": "within_band", "label_ko": "알맞음"},
        {"code": "too_indirect", "label_ko": "지나치게 우회적 (요청이 흐려짐)"},
    ],
    "excluded_confounds": ["격식체 어휘 선택 (尊敬的·恳请) — 공손성 축", "호칭 (您 vs 你) — 공손성 축", "문장 길이 자체"],
}
BASE = {
    "direction": "ko_zh",
    "mode": "translation",
    "situation_ko": "평소 연락하던 거래처 담당자와 일정 확인 메시지를 주고받던 중, 다음 주 미팅 장소를 우리 쪽 근처로 바꿀 수 있는지 묻는다.",
    "relation_ko": "거래처 담당자 — 몇 번 연락했지만 친밀하지는 않은 사이",
    "pdr": {"p": "equal", "d": "acquaintance", "r": "mid"},
    "source_text": "다음 주 미팅 장소를 저희 쪽 근처로 바꿔 주실 수 있을까요?",
    "preceding_turn": "下周的会议地点还是老地方吗？",
    "feature": FEATURE,
    "rubric_version": "request_mitigation_optionality@1.0",
}

CASES = {
    "meaning": ("ⓐ 의미 누락", "meaning", "下周的会议还是老地方，没问题。"),
    "grammar": ("ⓑ 문법 붕괴", "grammar", "下周会议地点把改我们这边附近吗？"),
    "feature": ("ⓒ 너무 직접적", "feature", "把下周的会议地点改到我们这边附近。"),
    "clear": ("ⓓ 이미 적절", "clear", "麻烦您看一下，下周的会议地点方便改到我们这边附近吗？"),
}
SELECTED_CASES = list(CASES.values()) if args.case == "all" else [CASES[args.case]]

def derive(v):
    if v["semantic_fidelity"] != "preserved": return "meaning"
    if v["grammatical_accuracy"] == "impeding_errors": return "grammar"
    if v["pragmatic_appropriateness"]["band_code"] != "within_band": return "feature"
    return "clear"

print("=" * 72)
grand_ok = 0
grand_total = len(SELECTED_CASES) * len(MODES) * args.repeat
for mode in MODES:
    print(f"\n산출 모드: {mode}")
    mode_ok = 0
    mode_total = len(SELECTED_CASES) * args.repeat
    for repeat_index in range(1, args.repeat + 1):
        for label, expect, answer in SELECTED_CASES:
            body = {
                "action": "feedback",
                "feedback": dict(BASE, mode=mode, answer=answer),
            }
            req = urllib.request.Request(
                URL,
                data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
            )
            try:
                r = json.loads(urllib.request.urlopen(req, timeout=90).read().decode("utf-8"))
            except Exception as e:
                print(f"{label} ({repeat_index}/{args.repeat}): 호출 실패 {e}")
                continue
            fb = r.get("feedback", {})
            v = fb.get("verdicts", {})
            got = derive(v)
            hit = "PASS" if got == expect else "FAIL"
            if got == expect:
                mode_ok += 1
                grand_ok += 1
            b = fb.get("blocks", {})
            print(f"\n[{label} · {repeat_index}/{args.repeat}] 기대={expect} / 실제={got}  → {hit}")
            print(f"  답안: {answer}")
            print(f"  verdicts: 의미={v.get('semantic_fidelity')} 문법={v.get('grammatical_accuracy')} 대역={v.get('pragmatic_appropriateness',{}).get('band_code')}")
            print(f"  의미: {b.get('meaning_ko','')}")
            g = b.get("grammar", [])
            print(f"  문법({len(g)}건): {(g[0].get('explanation_ko','')[:80] if g else '-')}")
            print(f"  화용: {b.get('feature_ko','')[:110]}")
            alts = b.get("alternatives", [])
            for a in alts[:2]:
                print(f"  대안: {a.get('text','')}  ({a.get('note_ko','')[:50]})")
            uf = fb.get("uncertainty_flags", [])
            if uf:
                print(f"  불확실: {len(uf)}건")
    print(f"\n{mode} 결과: {mode_ok}/{mode_total} 통과")

print("\n" + "=" * 72)
print(f"수락 검수 결과: {grand_ok}/{grand_total} 통과")
if grand_ok != grand_total:
    raise SystemExit(1)
