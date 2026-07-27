"""배포된 TTS→STT 경로의 한·중 왕복 및 학습자 오류 보존 스모크."""

import argparse
import hashlib
import json
from pathlib import Path
import unicodedata
import urllib.error
import urllib.request
import uuid


ROOT = Path(__file__).resolve().parents[2]


def read_env():
    values = {}
    for raw_line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value.strip().strip("'\"")
    return values


ENV = read_env()
BASE_URL = ENV["VITE_SUPABASE_URL"] + "/functions/v1"
ANON_KEY = ENV["VITE_SUPABASE_PUBLISHABLE_KEY"]
AUTH_HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": "Bearer " + ANON_KEY,
}

CASES = {
    "ko": {
        "label": "한국어 원발화",
        "lang": "ko",
        "text": "교수님, 오늘 시연할 통역 학습 미션의 음성 품질을 확인합니다.",
    },
    "zh": {
        "label": "중국어 원발화",
        "lang": "zh",
        "text": "请问下周的会议地点方便改到我们这边附近吗？",
    },
    "zh-error": {
        "label": "중국어 오류 보존",
        "lang": "zh",
        "text": "我昨天去学校了，然后我没有去了。",
    },
}


def normalized(text):
    """문자 내용은 보존하되 API가 삽입한 공백·문장부호 차이는 무시한다."""
    return "".join(
        char.casefold()
        for char in text
        if not char.isspace() and not unicodedata.category(char).startswith(("P", "S"))
    )


def call_tts(text, lang):
    body = json.dumps({"text": text, "lang": lang}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL + "/tts",
        data=body,
        headers={**AUTH_HEADERS, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        audio = response.read()
        content_type = response.headers.get("Content-Type", "")
        if not content_type.startswith("audio/") or not audio:
            raise RuntimeError(f"TTS가 음성을 반환하지 않았습니다: {content_type}")
        return audio, {
            "provider": response.headers.get("X-TTS-Provider", "unknown"),
            "model": response.headers.get("X-TTS-Model", "unknown"),
            "voice": response.headers.get("X-TTS-Voice-Id", "unknown"),
            "sha256": hashlib.sha256(audio).hexdigest(),
        }


def multipart_body(audio, lang):
    boundary = "----pragma-audio-" + uuid.uuid4().hex
    chunks = []

    def add(value):
        chunks.append(value if isinstance(value, bytes) else value.encode("utf-8"))

    add(f"--{boundary}\r\n")
    add('Content-Disposition: form-data; name="lang"\r\n\r\n')
    add(lang)
    add("\r\n")
    add(f"--{boundary}\r\n")
    add('Content-Disposition: form-data; name="file"; filename="roundtrip.mp3"\r\n')
    add("Content-Type: audio/mpeg\r\n\r\n")
    add(audio)
    add("\r\n")
    add(f"--{boundary}--\r\n")
    return b"".join(chunks), boundary


def call_stt(audio, lang):
    body, boundary = multipart_body(audio, lang)
    request = urllib.request.Request(
        BASE_URL + "/stt",
        data=body,
        headers={
            **AUTH_HEADERS,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("STT 전사 결과가 비어 있습니다.")
    return text.strip(), payload.get("provenance", {})


def run_case(case):
    audio, tts = call_tts(case["text"], case["lang"])
    transcript, stt = call_stt(audio, case["lang"])
    exact = normalized(transcript) == normalized(case["text"])
    print(f"\n[{case['label']}] {'PASS' if exact else 'FAIL'}")
    print(f"  원문: {case['text']}")
    print(f"  전사: {transcript}")
    print(
        "  TTS:"
        f" {tts['provider']}/{tts['model']}/{tts['voice']}"
        f" · {len(audio):,} bytes · sha256={tts['sha256'][:12]}…"
    )
    print(
        "  STT:"
        f" {stt.get('provider', 'unknown')}/{stt.get('model', 'unknown')}"
        f" · lang={stt.get('language', case['lang'])}"
    )
    return exact


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--case",
        choices=("all", *CASES.keys()),
        default="all",
        help="검사할 음성 케이스(기본: all)",
    )
    args = parser.parse_args()
    selected = CASES.values() if args.case == "all" else (CASES[args.case],)

    passed = 0
    total = 0
    print("=" * 72)
    print("배포 음성 왕복 검사 — TTS 음원을 생성해 그대로 STT에 입력합니다.")
    for case in selected:
        total += 1
        try:
            passed += int(run_case(case))
        except (OSError, RuntimeError, urllib.error.HTTPError) as error:
            detail = ""
            if isinstance(error, urllib.error.HTTPError):
                detail = error.read().decode("utf-8", errors="replace")
            print(f"\n[{case['label']}] 호출 실패: {error} {detail}".rstrip())

    print("\n" + "=" * 72)
    print(f"음성 왕복 결과: {passed}/{total} 통과")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
