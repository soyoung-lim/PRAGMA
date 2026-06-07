import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, devStubCompleteProfile } from "@/lib/auth/useProfile";
import { HomeBrand } from "@/components/HomeBrand";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const AFFILIATION_OPTIONS = [
  "학부생",
  "대학원생(석사)",
  "대학원생(박사)",
  "교강사/연구자",
  "현직 통번역사",
  "기타",
];
const LANGUAGE_BG_OPTIONS = [
  "한국어 모어",
  "중국어 모어",
  "이중언어(한·중)",
  "기타",
];
const CHINESE_PROFICIENCY_OPTIONS = [
  "HSK 3급 이하 / 초급",
  "HSK 4급 / 중급",
  "HSK 5급 / 중상급",
  "HSK 6급 / 고급",
  "원어민 수준",
];
const BUSINESS_CN_EXP_OPTIONS = ["없음", "1년 미만", "1~3년", "3년 이상"];
const TI_LEVEL_OPTIONS = [
  "경험 없음",
  "학습 중(수업 위주)",
  "보조/실습 수준",
  "현업 경험 있음",
];
const TI_MODE_OPTIONS = ["번역(문서)", "순차통역", "동시통역", "영상/자막", "기타"];
const GENAI_FREQ_OPTIONS = ["거의 사용 안 함", "월 1~2회", "주 1~2회", "거의 매일"];
const PROMPT_STYLE_OPTIONS = [
  "거의 프롬프트를 안 씀",
  "단순 지시 위주",
  "맥락·역할 지정 등 구조화",
  "반복적 수정·평가까지 활용",
];
const PERCEIVED_DIFFICULTY_OPTIONS = ["매우 쉬움", "쉬움", "보통", "어려움", "매우 어려움"];
const PERCEIVED_RISK_OPTIONS = ["매우 낮음", "낮음", "보통", "높음", "매우 높음"];

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { loading, session, profile, isDevStub, refresh } = useProfile();

  const [step, setStep] = useState<Step>(1);

  // Screen 1
  const [fullName, setFullName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [languageBg, setLanguageBg] = useState("");

  // Screen 2
  const [chineseProf, setChineseProf] = useState("");
  const [bizCnExp, setBizCnExp] = useState("");
  const [tiLevel, setTiLevel] = useState("");
  const [tiModes, setTiModes] = useState<string[]>([]);
  const [genaiFreq, setGenaiFreq] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  const [perceivedDifficulty, setPerceivedDifficulty] = useState("");
  const [perceivedRisk, setPerceivedRisk] = useState("");

  // Screen 3
  const [researchConsent, setResearchConsent] = useState(false);
  const [anonConfirmed, setAnonConfirmed] = useState(false);
  const [reportConsent, setReportConsent] = useState(false);

  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }

  if (!session && !isDevStub) {
    return <Navigate to="/student-login" replace />;
  }

  if (profile?.profile_completed) {
    return <Navigate to="/scenario" replace />;
  }

  const trimmedName = fullName.trim();

  const step1Valid =
    trimmedName.length > 0 && affiliation !== "" && languageBg !== "";
  const step2Valid =
    chineseProf !== "" &&
    bizCnExp !== "" &&
    tiLevel !== "" &&
    tiModes.length > 0 &&
    genaiFreq !== "" &&
    promptStyle !== "";
  const step3Valid = researchConsent && anonConfirmed;
  const canSubmit = step1Valid && step2Valid && step3Valid && !busy;

  const toggleMode = (m: string) => {
    setTiModes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isDevStub) {
        devStubCompleteProfile(trimmedName);
      } else if (profile) {
        const payload = {
          full_name: trimmedName,
          affiliation_or_status: affiliation,
          academic_year_or_program: academicYear || null,
          language_background: languageBg,
          chinese_proficiency_self_report: chineseProf,
          business_chinese_experience: bizCnExp,
          ti_experience_level: tiLevel,
          ti_experience_modes: tiModes,
          genai_use_frequency: genaiFreq,
          ai_prompting_style_for_ti: promptStyle,
          perceived_ai_ti_difficulty: perceivedDifficulty || null,
          perceived_business_chinese_ti_risk: perceivedRisk || null,
          research_use_consent: researchConsent,
          anonymization_notice_confirmed: anonConfirmed,
          report_email_consent: reportConsent,
          profile_completed: true,
        };
        const { error } = await supabase
          .from("profiles")
          .update(payload as never)
          .eq("user_id", profile.user_id);
        if (error) throw error;
      }
      await refresh();
      navigate("/scenario", { replace: true });
    } catch {
      toast.error("프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  const StepIndicator = () => (
    <div className="mb-6 flex items-center gap-2 text-xs">
      {[1, 2, 3].map((n) => {
        const active = step === (n as Step);
        const done = step > n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold ${
                active
                  ? "border-[#15202B] bg-[#15202B] text-white"
                  : done
                  ? "border-[#15202B] bg-background text-[#15202B]"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {n}
            </div>
            <span
              className={
                active
                  ? "font-medium"
                  : "text-muted-foreground"
              }
            >
              {n === 1 ? "기본 정보" : n === 2 ? "언어·통번역 배경" : "동의·연락"}
            </span>
            {n < 3 && <span className="text-muted-foreground">›</span>}
          </div>
        );
      })}
    </div>
  );

  const inputCls =
    "mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const RadioGroup = ({
    name,
    value,
    onChange,
    options,
  }: {
    name: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
  }) => (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {options.map((opt) => (
        <label
          key={opt}
          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
            value === opt ? "border-[#15202B] bg-muted/40" : "border-border"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-4 w-4"
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );

  const Field = ({
    label,
    required,
    children,
  }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-sm font-medium">
        {label}{" "}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-xs text-muted-foreground">(선택)</span>
        )}
      </label>
      {children}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">프로필 설정</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          학습을 시작하기 전에 연구 배경 정보를 입력해 주세요. (3단계)
        </p>

        <div className="mt-8">
          <StepIndicator />
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <Field label="이름" required>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                className={inputCls}
                placeholder="실명을 입력해 주세요"
              />
            </Field>

            <Field label="소속/신분" required>
              <RadioGroup
                name="affiliation"
                value={affiliation}
                onChange={setAffiliation}
                options={AFFILIATION_OPTIONS}
              />
            </Field>

            <Field label="학년/과정">
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                maxLength={100}
                className={inputCls}
                placeholder="예: 학부 3학년, 통번역대학원 1학기"
              />
            </Field>

            <Field label="언어 배경" required>
              <RadioGroup
                name="language_bg"
                value={languageBg}
                onChange={setLanguageBg}
                options={LANGUAGE_BG_OPTIONS}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Field label="중국어 능력 자기보고" required>
              <RadioGroup
                name="chinese_prof"
                value={chineseProf}
                onChange={setChineseProf}
                options={CHINESE_PROFICIENCY_OPTIONS}
              />
            </Field>

            <Field label="비즈니스 중국어 경험" required>
              <RadioGroup
                name="biz_cn_exp"
                value={bizCnExp}
                onChange={setBizCnExp}
                options={BUSINESS_CN_EXP_OPTIONS}
              />
            </Field>

            <Field label="통번역 경험 수준" required>
              <RadioGroup
                name="ti_level"
                value={tiLevel}
                onChange={setTiLevel}
                options={TI_LEVEL_OPTIONS}
              />
            </Field>

            <Field label="통번역 경험 형태 (복수 선택)" required>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TI_MODE_OPTIONS.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      tiModes.includes(m)
                        ? "border-[#15202B] bg-muted/40"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={tiModes.includes(m)}
                      onChange={() => toggleMode(m)}
                      className="h-4 w-4"
                    />
                    <span>{m}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="생성형 AI 사용 빈도" required>
              <RadioGroup
                name="genai_freq"
                value={genaiFreq}
                onChange={setGenaiFreq}
                options={GENAI_FREQ_OPTIONS}
              />
            </Field>

            <Field label="통번역용 AI 프롬프트 사용 스타일" required>
              <RadioGroup
                name="prompt_style"
                value={promptStyle}
                onChange={setPromptStyle}
                options={PROMPT_STYLE_OPTIONS}
              />
            </Field>

            <Field label="AI 활용 통번역의 체감 난이도">
              <RadioGroup
                name="perceived_difficulty"
                value={perceivedDifficulty}
                onChange={setPerceivedDifficulty}
                options={PERCEIVED_DIFFICULTY_OPTIONS}
              />
            </Field>

            <Field label="비즈니스 중국어 통번역의 체감 리스크">
              <RadioGroup
                name="perceived_risk"
                value={perceivedRisk}
                onChange={setPerceivedRisk}
                options={PERCEIVED_RISK_OPTIONS}
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="rounded-md border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
              식별정보(이름·이메일)는 운영 목적으로만 사용되며, 연구 분석은 익명
              식별자로만 수행됩니다.
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={researchConsent}
                  onChange={(e) => setResearchConsent(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="font-medium">[필수]</span> 연구 목적의 학습 데이터
                  활용에 동의합니다.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={anonConfirmed}
                  onChange={(e) => setAnonConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="font-medium">[필수]</span> 연구 분석은 익명
                  식별자로만 수행됨을 확인했습니다.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={reportConsent}
                  onChange={(e) => setReportConsent(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="text-muted-foreground">[선택]</span> 학습 리포트
                  이메일 수신에 동의합니다.
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            disabled={step === 1 || busy}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
              className="rounded-md bg-[#15202B] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-md bg-[#15202B] px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "저장 중…" : "학습 시작하기"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfileSetup;