import { Link } from "react-router-dom";
import { HomeBrand } from "@/components/HomeBrand";

// 개인정보처리방침은 두 가지를 동시에 만족해야 한다.
//   ① Google OAuth 동의 화면이 요구하는 공개 링크(비로그인 접근 가능해야 한다).
//   ② 학습 수행 기록을 연구 자료로 쓰는 데 필요한 고지.
// 수집 항목은 실제 스키마(profiles · learner_mission_events)에서 확인한 것만 적는다.
// 보관 기간·연구윤리 심의·문의처는 연구자가 확정할 사항이라 [확인 필요]로 남긴다.
// 확정 전까지 이 페이지를 연구 참여 동의서로 쓰지 않는다.

const UPDATED_AT = "2026-08-29";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-8 first:mt-0">
    <h2 className="break-keep text-[16px] font-bold leading-snug tracking-[-0.02em] text-[#15202B]">
      {title}
    </h2>
    <div className="mt-2.5 space-y-2 break-keep text-[13.5px] leading-relaxed text-[#4A4639]">
      {children}
    </div>
  </section>
);

const Pending = () => (
  <span className="rounded bg-[#FDF3D0] px-1.5 py-0.5 text-[12.5px] font-semibold text-[#7A6410]">
    [확인 필요]
  </span>
);

const Privacy = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-10 sm:px-6 sm:py-14">
        <h1 className="break-keep text-[27px] font-bold leading-[1.25] tracking-[-0.025em] text-[#15202B]">
          개인정보처리방침
        </h1>
        <p className="mt-2.5 break-keep text-[13.5px] leading-relaxed text-[#6B665C]">
          PRAGMA는 한국외국어대학교 박사학위논문 연구를 위해 개발·운영되는 학습용 웹
          애플리케이션입니다. 최종 갱신 {UPDATED_AT}.
        </p>

        <div className="mt-9 rounded-xl border border-l-[5px] border-[#E8E4D8] border-l-[#FAD338] bg-white p-6 shadow-sm sm:p-8">
          <Section title="1. 수집하는 항목">
            <p>
              <strong>계정 정보</strong> — Google 계정 이메일 주소, 서비스 내부 역할과 승인 상태,
              익명 참여자 식별자, 가입·수정 시각.
            </p>
            <p>
              <strong>학습 수행 기록</strong> — 미션 시작·재개 이력, 화용 판단 과제 응답, 맥락 대비
              판단, 최초 산출물, 제공된 피드백, 학습자가 남긴 이의, 수정 산출물.
            </p>
            <p className="text-[#6B665C]">
              별도의 주민등록번호·연락처·결제 정보는 수집하지 않습니다.
            </p>
          </Section>

          <Section title="2. 이용 목적">
            <p>
              학습 기능 제공(진행 상황 저장과 이어하기)과 학위논문 연구를 위한 분석에만
              이용합니다. 그 밖의 목적으로 이용하지 않으며, 광고·마케팅에 활용하지 않습니다.
            </p>
          </Section>

          <Section title="3. 보관 기간과 파기">
            <p>
              보관 기간과 파기 방법은 확정 후 이 항에 명시합니다. <Pending />
            </p>
          </Section>

          <Section title="4. 처리 위탁">
            <p>제3자에게 개인정보를 판매하거나 제공하지 않습니다. 서비스 운영을 위해 다음을 이용합니다.</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Supabase — 데이터베이스·인증</li>
              <li>Railway — 애플리케이션 배포</li>
              <li>OpenAI, Anthropic — 학습 콘텐츠 생성 및 검수</li>
              <li>ElevenLabs — 음성 합성</li>
            </ul>
          </Section>

          <Section title="5. 이용자의 권리">
            <p>
              열람·정정·삭제·처리정지를 요구할 수 있습니다. 계정을 삭제하면 연결된 학습 수행
              기록도 함께 삭제됩니다.
            </p>
          </Section>

          <Section title="6. 연구윤리">
            <p>
              연구윤리 심의 여부와 승인 정보는 확정 후 이 항에 명시합니다. <Pending />
            </p>
          </Section>

          <Section title="7. 문의">
            <p>
              연구책임자 성명과 연락처는 확정 후 이 항에 명시합니다. <Pending />
            </p>
          </Section>
        </div>

        <Link
          to="/"
          className="group mt-7 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-[#687584] transition-colors hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
        >
          <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          시작 화면으로
        </Link>
      </main>
    </div>
  );
};

export default Privacy;
