import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, devStubCompleteProfile } from "@/lib/auth/useProfile";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const AFFILIATION_OPTIONS = [
  "학부생",
  "대학원생(석사)",
  "대학원생(박사)",
  "교강사/연구자",
  "직장인",
  "기타",
];


// Coded options: UI shows `label`, DB stores `code`.
type CodedOption = { code: string; label: string };

const CHINESE_LEVEL_OPTIONS: CodedOption[] = [
  { code: "hsk3_or_below", label: "HSK 3급 이하" },
  { code: "hsk4", label: "HSK 4급" },
  { code: "hsk5", label: "HSK 5급" },
  { code: "hsk6", label: "HSK 6급" },
  { code: "native", label: "원어민 수준" },
];
const INTERPRETING_EXPERIENCE_OPTIONS: CodedOption[] = [
  { code: "none", label: "없음" },
  { code: "coursework", label: "수업 위주" },
  { code: "assisted", label: "실습·보조 경험" },
  { code: "professional", label: "현업 경험" },
];
const BUSINESS_CHINESE_EXPERIENCE_OPTIONS: CodedOption[] = [
  { code: "none", label: "없음" },
  { code: "under_1y", label: "1년 미만" },
  { code: "1_to_3y", label: "1–3년" },
  { code: "over_3y", label: "3년 이상" },
];

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

const CodedRadioGroup = ({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (code: string) => void;
  options: CodedOption[];
}) => (
  <div className="mt-2 grid gap-2 sm:grid-cols-2">
    {options.map((opt) => (
      <label
        key={opt.code}
        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
          value === opt.code ? "border-[#15202B] bg-muted/40" : "border-border"
        }`}
      >
        <input
          type="radio"
          name={name}
          value={opt.code}
          checked={value === opt.code}
          onChange={() => onChange(opt.code)}
          className="h-4 w-4"
        />
        <span>{opt.label}</span>
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

const StepIndicator = ({ step }: { step: Step }) => (
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
          <span className={active ? "font-medium" : "text-muted-foreground"}>
            {n === 1 ? "기본 정보" : n === 2 ? "학습자 배경" : "동의"}
          </span>
          {n < 3 && <span className="text-muted-foreground">›</span>}
        </div>
      );
    })}
  </div>
);

type Props = {
  onCompleted?: () => void;
};

export const ProfileWizardForm = ({ onCompleted }: Props) => {
  const { profile, isDevStub, refresh } = useProfile();

  const [step, setStep] = useState<Step>(1);

  // Screen 1
  const [fullName, setFullName] = useState("");
  const [affiliation, setAffiliation] = useState("");

  // Screen 2 — coded values
  const [chineseLevel, setChineseLevel] = useState("");
  const [interpretingExperience, setInterpretingExperience] = useState("");
  const [businessChineseExperience, setBusinessChineseExperience] = useState("");

  // Screen 3
  const [researchConsent, setResearchConsent] = useState(false);
  const [anonConfirmed, setAnonConfirmed] = useState(false);
  const [reportConsent, setReportConsent] = useState(false);

  const [busy, setBusy] = useState(false);

  const trimmedName = fullName.trim();

  const step1Valid = trimmedName.length > 0 && affiliation !== "";
  const step2Valid =
    chineseLevel !== "" &&
    interpretingExperience !== "" &&
    businessChineseExperience !== "";
  const step3Valid = researchConsent && anonConfirmed;
  const canSubmit = step1Valid && step2Valid && step3Valid && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (isDevStub) {
        devStubCompleteProfile(trimmedName);
      } else {
        // Resolve the user id even if the profile row hasn't loaded/been created yet.
        let userId = profile?.user_id ?? null;
        if (!userId) {
          const { data } = await supabase.auth.getUser();
          userId = data.user?.id ?? null;
        }
        if (!userId) throw new Error("no-auth-user");

        const payload = {
          user_id: userId,
          // New canonical columns
          name: trimmedName,
          affiliation: affiliation,
          grade_or_program: null,
          chinese_level: chineseLevel,
          interpreting_experience: interpretingExperience,
          business_chinese_experience: businessChineseExperience,
          consent_data_use: researchConsent,
          consent_anonymous_analysis: anonConfirmed,
          consent_email_report: reportConsent,
          // Keep full_name in sync (used by other screens)
          full_name: trimmedName,
          language_background: null,
          profile_completed: true,
        };
        const { error } = await supabase
          .from("profiles")
          .upsert(payload as never, { onConflict: "user_id" });
        if (error) throw error;
      }
      await refresh();
      // Notify every useProfile instance (e.g. the Home page) to reload.
      window.dispatchEvent(new Event("profile-changed"));
      onCompleted?.();
    } catch {
      toast.error("프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col">
      <StepIndicator step={step} />

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
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Field label="중국어 언어 수준" required>
            <CodedRadioGroup
              name="chinese_level"
              value={chineseLevel}
              onChange={setChineseLevel}
              options={CHINESE_LEVEL_OPTIONS}
            />
          </Field>

          <Field label="통번역 경험 수준" required>
            <CodedRadioGroup
              name="interpreting_experience"
              value={interpretingExperience}
              onChange={setInterpretingExperience}
              options={INTERPRETING_EXPERIENCE_OPTIONS}
            />
          </Field>

          <Field label="비즈니스 중국어 경험" required>
            <CodedRadioGroup
              name="business_chinese_experience"
              value={businessChineseExperience}
              onChange={setBusinessChineseExperience}
              options={BUSINESS_CHINESE_EXPERIENCE_OPTIONS}
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
    </div>
  );
};

export default ProfileWizardForm;