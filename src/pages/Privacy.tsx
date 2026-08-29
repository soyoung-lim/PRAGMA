import { Link } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

// 개인정보처리방침은 두 가지를 동시에 만족해야 한다.
//   ① Google OAuth 동의 화면이 요구하는 공개 링크(비로그인 접근 가능해야 한다).
//   ② 학습 수행 기록을 연구 자료로 쓰는 데 필요한 고지.
// 수집 항목은 실제 스키마(profiles · learner_mission_events)에서 확인한 것만 적는다.
// 보관 기간·연구윤리 심의·문의처는 연구자가 확정할 사항이라 [확인 필요]로 남긴다.
// 확정 전까지 이 페이지를 연구 참여 동의서로 쓰지 않는다.
//
// 레이아웃: 조항 7개짜리 고지문은 한 화면에 들어와야 읽힌다. 제목을 본문 위가 아니라
// 왼쪽 열에 두어 세로 높이를 접고(모바일은 1단), 요약 스트립은 학술 표의 상하 괘선
// 방식으로 처리한다. 장식용 카드·여백은 두지 않는다.

const UPDATED_AT = "2026-08-29";

const Pending = () => (
  <span className="ml-1.5 rounded bg-[#FDF3D0] px-1.5 py-px align-middle text-[11px] font-semibold text-[#7A6410]">
    확인 필요
  </span>
);

const Row = ({
  no,
  title,
  children,
}: {
  no: string;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-1 gap-x-8 gap-y-1 border-t border-[#ECE8DD] py-3.5 sm:grid-cols-[172px_1fr]">
    <h2 className="break-keep text-[13.5px] font-bold leading-snug tracking-[-0.01em] text-[#15202B]">
      <span className="mr-2 font-semibold tabular-nums text-[#B6AF9C]">{no}</span>
      {title}
    </h2>
    <div className="min-w-0 space-y-1.5 break-keep text-[13px] leading-[1.65] text-[#4A4639]">
      {children}
    </div>
  </div>
);

const Privacy = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-8 sm:px-6 sm:py-10">
        <h1 className="break-keep text-[22px] font-bold leading-tight tracking-[-0.02em] text-[#15202B]">
          개인정보처리방침
        </h1>
        <p className="mt-1.5 break-keep text-[13px] leading-[1.65] text-[#4A4639]">
          PRAGMA는 한국외국어대학교 박사학위논문 연구를 위해 개발·운영되는 학습용 웹
          애플리케이션입니다.
        </p>
        <p className="mt-1 text-[12px] text-[#8A8578]">
          최종 갱신 {UPDATED_AT} · 초안 — 보관 기간·연구윤리·문의처는 확정 후 명시
        </p>

        {/* 요약 — 학술 표의 상하 괘선. 상세를 읽지 않아도 핵심 세 가지가 먼저 보인다. */}
        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-2 border-y-2 border-[#15202B] py-2.5">
          {[
            ["수집", "계정 정보와 학습 수행 기록"],
            ["목적", "학습 기능 제공과 학위논문 연구"],
            ["제3자 제공", "없음"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <dt className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#8A8578]">
                {k}
              </dt>
              <dd className="break-keep text-[13px] font-medium text-[#15202B]">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4">
          <Row no="01" title="수집하는 항목">
            <p>
              <strong className="font-semibold text-[#15202B]">계정 정보</strong> — Google 계정
              이메일 주소, 서비스 내부 역할과 승인 상태, 익명 참여자 식별자, 가입·수정 시각.
            </p>
            <p>
              <strong className="font-semibold text-[#15202B]">학습 수행 기록</strong> — 미션
              시작·재개 이력, 화용 판단 과제 응답, 맥락 대비 판단, 최초 산출물, 제공된 피드백,
              학습자가 남긴 이의, 수정 산출물.
            </p>
            <p className="text-[#8A8578]">주민등록번호·연락처·결제 정보는 수집하지 않습니다.</p>
          </Row>

          <Row no="02" title="이용 목적">
            <p>
              학습 기능 제공(진행 상황 저장과 이어하기)과 학위논문 연구를 위한 분석에만
              이용합니다. 그 밖의 목적과 광고·마케팅에 활용하지 않습니다.
            </p>
          </Row>

          <Row no="03" title="보관 기간과 파기">
            <p>
              보관 기간과 파기 방법은 확정 후 이 항에 명시합니다.
              <Pending />
            </p>
          </Row>

          <Row no="04" title="처리 위탁">
            <p>
              제3자에게 판매·제공하지 않습니다. 서비스 운영을 위해{" "}
              <strong className="font-semibold text-[#15202B]">Supabase</strong>(데이터베이스·인증)
              · <strong className="font-semibold text-[#15202B]">Railway</strong>(배포) ·{" "}
              <strong className="font-semibold text-[#15202B]">OpenAI·Anthropic</strong>(콘텐츠
              생성·검수) · <strong className="font-semibold text-[#15202B]">ElevenLabs</strong>(음성
              합성)를 이용합니다.
            </p>
          </Row>

          <Row no="05" title="이용자의 권리">
            <p>
              열람·정정·삭제·처리정지를 요구할 수 있습니다. 계정을 삭제하면 연결된 학습 수행
              기록도 함께 삭제됩니다.
            </p>
          </Row>

          <Row no="06" title="연구윤리">
            <p>
              연구윤리 심의 여부와 승인 정보는 확정 후 이 항에 명시합니다.
              <Pending />
            </p>
          </Row>

          <Row no="07" title="문의">
            <p>
              연구책임자 성명과 연락처는 확정 후 이 항에 명시합니다.
              <Pending />
            </p>
          </Row>
        </div>

        <div className="flex items-center justify-between border-t-2 border-[#15202B] pt-3.5">
          <Link
            to="/"
            className="group inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-medium text-[#687584] transition-colors hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
          >
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            시작 화면으로
          </Link>
          <span className="text-[11.5px] text-[#B6AF9C]">PRAGMA · {UPDATED_AT}</span>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
