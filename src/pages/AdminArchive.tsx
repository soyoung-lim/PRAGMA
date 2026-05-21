import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { HomeBrand } from "@/components/HomeBrand";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const Required = () => (
  <span className="ml-1 text-[#D14343]" aria-label="필수">
    *
  </span>
);

const SectionHeader = ({ title }: { title: string }) => (
  <div className="mb-4 flex items-center gap-2 border-b border-border pb-2">
    <span aria-hidden className="inline-block h-4 w-[3px] rounded-sm bg-[#FAD338]" />
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
  </div>
);

const FieldRow = ({
  label,
  required,
  htmlFor,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  error?: string;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-sm text-foreground">
      {label}
      {required && <Required />}
    </Label>
    {children}
    {error && <p className="text-xs text-[#D14343]">{error}</p>}
  </div>
);

type FormState = {
  title: string;
  mode: string;
  topic: string;
  item_type: string;
  difficulty: string;
  speech_act: string;
  discourse_genre: string;
  sector: string;
  source_text: string;
  source_origin: string;
  audio_url: string;
  youtube_url: string;
  youtube_id: string;
  is_learning_pick: boolean;
  status: string;
  researcher_notes: string;
};

type ArchiveItem = {
  id: string;
  title: string;
  mode: string;
  speech_act: string | null;
  discourse_genre: string | null;
  sector: string | null;
  difficulty: string | null;
  source_text: string | null;
  is_learning_pick: boolean | null;
  status: string | null;
  updated_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  archive: "아카이브",
  coursework_candidate: "수업자료 후보",
  experiment_candidate: "본실험 후보",
  locked: "본실험 확정",
  excluded: "제외",
};

const STATUS_STYLES: Record<string, string> = {
  archive: "bg-[#E5E5E5] text-[#444]",
  coursework_candidate: "bg-[#E0EAF5] text-[#274A6E]",
  experiment_candidate: "bg-[#C9DCF0] text-[#1B3A5C]",
  locked: "bg-[#F5E8C0] text-[#6E5320]",
  excluded: "bg-[#F0DDDD] text-[#8A2A2A] line-through",
};

const MODE_STYLES: Record<string, string> = {
  번역: "bg-[#F1E8DA] text-[#6B533A]",
  통역: "bg-[#DDE7F2] text-[#2F4E73]",
};

const formatUpdatedAt = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day} 수정`;
};

const initialForm: FormState = {
  title: "",
  mode: "번역",
  topic: "",
  item_type: "",
  difficulty: "",
  speech_act: "",
  discourse_genre: "",
  sector: "",
  source_text: "",
  source_origin: "manual",
  audio_url: "",
  youtube_url: "",
  youtube_id: "",
  is_learning_pick: false,
  status: "archive",
  researcher_notes: "",
};

const AdminArchive = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<{ title?: string; mode?: string }>({});
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fetchCount = async () => {
    const { count: c, error } = await supabase
      .from("archive_items")
      .select("*", { count: "exact", head: true });
    if (error) {
      console.error("count fetch error", error);
      return;
    }
    setCount(c ?? 0);
  };

  const fetchItems = async () => {
    setListError(null);
    const { data, error } = await supabase
      .from("archive_items")
      .select(
        "id,title,mode,speech_act,discourse_genre,sector,difficulty,source_text,is_learning_pick,status,updated_at",
      )
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("archive_items fetch error", error);
      setListError("자료를 불러오는 중 오류가 발생했습니다.");
      toast.error("자료를 불러오는 중 오류가 발생했습니다.");
      setItems([]);
      return;
    }
    setItems((data ?? []) as ArchiveItem[]);
  };

  useEffect(() => {
    fetchCount();
    fetchItems();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    setOpen(false);
  };

  const handleSave = async () => {
    const nextErrors: { title?: string; mode?: string } = {};
    if (!form.title.trim()) nextErrors.title = "제목을 입력해주세요";
    if (form.mode !== "번역" && form.mode !== "통역")
      nextErrors.mode = "모드를 선택해주세요";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v);

    const payload = {
      title: form.title.trim(),
      mode: form.mode,
      topic: nullIfEmpty(form.topic),
      item_type: nullIfEmpty(form.item_type),
      difficulty: form.difficulty || null,
      speech_act: form.speech_act || null,
      discourse_genre: form.discourse_genre || null,
      sector: form.sector || null,
      source_text: nullIfEmpty(form.source_text),
      source_origin: form.source_origin || "manual",
      audio_url: nullIfEmpty(form.audio_url),
      youtube_url: nullIfEmpty(form.youtube_url),
      youtube_id: nullIfEmpty(form.youtube_id),
      is_learning_pick: form.is_learning_pick,
      status: form.status || "archive",
      researcher_notes: nullIfEmpty(form.researcher_notes),
      title_auto_generated: false,
    };

    setSaving(true);
    const { error } = await supabase.from("archive_items").insert(payload);
    setSaving(false);

    if (error) {
      console.error("archive_items insert error", error);
      toast.error("저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    toast.success("자료가 저장되었습니다.");
    resetForm();
    setCount((c) => (c === null ? 1 : c + 1));
    fetchCount();
    fetchItems();
  };

  const handleAiTitle = () => toast("후속 구현 예정");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-[#8899A6] transition-colors hover:text-[#F1EFE8]"
            >
              ← 학습자 화면으로
            </Link>
            <span className="rounded-md border border-[#5C6A7A] bg-transparent px-3 py-1.5 text-sm font-medium text-[#F1EFE8]">
              관리자 영역
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 sm:py-14">
        <section>
          <div className="flex items-stretch gap-3">
            <span
              aria-hidden
              className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]"
            />
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                통번역 데이터 아카이브
              </h1>
              <p className="mt-1 text-xl text-muted-foreground sm:text-2xl">
                Interpretation & Translation Archive
              </p>
              <p className="mt-1 text-base text-muted-foreground sm:text-lg">
                한·중 AI 통번역 학습자료 큐레이션
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
            <span className="text-foreground">전체 자료</span>
            <span className="font-semibold text-foreground">
              {count === null ? "—" : `${count}건`}
            </span>
          </div>
        </section>

        <section className="mt-8">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <p className="text-sm leading-relaxed text-muted-foreground">
              이 메타데이터는 자료 큐레이션·검색을 위한 운영 태그이며, 본실험 통제 조건은 별도 locked scenario 단계에서 확정됩니다.
            </p>
          </div>
        </section>

        <section className="mt-8">
          {!open ? (
            <Button
              onClick={() => setOpen(true)}
              className="bg-[#15202B] text-[#F1EFE8] hover:bg-[#1f2d3a]"
            >
              + 새 자료 등록
            </Button>
          ) : (
            <div className="mx-auto w-full lg:w-[70%]">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    새 자료 등록
                  </h2>
                  <span className="rounded-md border border-border bg-[#FFF8DC] px-2 py-0.5 text-xs text-[#7a5e00]">
                    초안
                  </span>
                </div>

                <div className="space-y-10">
                  {/* Group 1 */}
                  <div>
                    <SectionHeader title="기본 정보" />
                    <div className="space-y-5">
                      <FieldRow label="제목" required htmlFor="title" error={errors.title}>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="title"
                            placeholder="자료 제목"
                            value={form.title}
                            onChange={(e) => setField("title", e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAiTitle}
                            className="shrink-0"
                          >
                            AI 제목 생성
                          </Button>
                        </div>
                      </FieldRow>

                      <FieldRow label="모드" required error={errors.mode}>
                        <RadioGroup
                          value={form.mode}
                          onValueChange={(v) => setField("mode", v)}
                          className="flex gap-6 pt-1"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="번역" id="mode-trans" />
                            <Label htmlFor="mode-trans" className="font-normal">번역</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="통역" id="mode-interp" />
                            <Label htmlFor="mode-interp" className="font-normal">통역</Label>
                          </div>
                        </RadioGroup>
                      </FieldRow>

                      <FieldRow label="주제" htmlFor="topic">
                        <Input
                          id="topic"
                          placeholder="예: 신제품 출시 회의"
                          value={form.topic}
                          onChange={(e) => setField("topic", e.target.value)}
                        />
                      </FieldRow>

                      <FieldRow label="자료 유형" htmlFor="item_type">
                        <Input
                          id="item_type"
                          placeholder="예: dialogue, email, monologue"
                          value={form.item_type}
                          onChange={(e) => setField("item_type", e.target.value)}
                        />
                      </FieldRow>

                      <FieldRow label="난이도">
                        <Select
                          value={form.difficulty}
                          onValueChange={(v) => setField("difficulty", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="중급">중급</SelectItem>
                            <SelectItem value="고급">고급</SelectItem>
                            <SelectItem value="전문가">전문가</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>
                    </div>
                  </div>

                  {/* Group 2 */}
                  <div>
                    <SectionHeader title="화행·맥락 메타데이터" />
                    <div className="space-y-5">
                      <FieldRow label="화행">
                        <Select
                          value={form.speech_act}
                          onValueChange={(v) => setField("speech_act", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="요청">요청</SelectItem>
                            <SelectItem value="거절">거절</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>

                      <FieldRow label="담화 장르">
                        <Select
                          value={form.discourse_genre}
                          onValueChange={(v) => setField("discourse_genre", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="비즈니스 이메일">비즈니스 이메일</SelectItem>
                            <SelectItem value="업무 메신저">업무 메신저</SelectItem>
                            <SelectItem value="회의 발화">회의 발화</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>

                      <FieldRow label="섹터">
                        <Select
                          value={form.sector}
                          onValueChange={(v) => setField("sector", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="엔터테인먼트">엔터테인먼트</SelectItem>
                            <SelectItem value="테크·IT">테크·IT</SelectItem>
                            <SelectItem value="무역·비즈니스">무역·비즈니스</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>
                    </div>
                  </div>

                  {/* Group 3 */}
                  <div>
                    <SectionHeader title="원문·출처" />
                    <div className="space-y-5">
                      <FieldRow label="원문 / 전사 텍스트" htmlFor="source_text">
                        <Textarea
                          id="source_text"
                          rows={6}
                          placeholder="원문을 붙여넣거나 직접 입력"
                          className="min-h-[160px]"
                          value={form.source_text}
                          onChange={(e) => setField("source_text", e.target.value)}
                        />
                      </FieldRow>

                      <FieldRow label="자료 출처">
                        <Select
                          value={form.source_origin}
                          onValueChange={(v) => setField("source_origin", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">manual · 직접 입력</SelectItem>
                            <SelectItem value="ai_draft">ai_draft · AI 초안</SelectItem>
                            <SelectItem value="stt">stt · 음성 인식</SelectItem>
                            <SelectItem value="youtube">youtube · YouTube</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>

                      <FieldRow label="오디오 URL" htmlFor="audio_url">
                        <Input
                          id="audio_url"
                          type="url"
                          placeholder="https://..."
                          value={form.audio_url}
                          onChange={(e) => setField("audio_url", e.target.value)}
                        />
                      </FieldRow>

                      <FieldRow label="YouTube URL" htmlFor="youtube_url">
                        <Input
                          id="youtube_url"
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={form.youtube_url}
                          onChange={(e) => setField("youtube_url", e.target.value)}
                        />
                      </FieldRow>

                      <FieldRow label="YouTube ID" htmlFor="youtube_id">
                        <Input
                          id="youtube_id"
                          placeholder="예: dQw4w9WgXcQ"
                          value={form.youtube_id}
                          onChange={(e) => setField("youtube_id", e.target.value)}
                        />
                      </FieldRow>
                    </div>
                  </div>

                  {/* Group 4 */}
                  <div>
                    <SectionHeader title="운영 태그" />
                    <div className="space-y-5">
                      <FieldRow label="학습자료 후보">
                        <div className="flex items-center gap-2 pt-1">
                          <Checkbox
                            id="is_learning_pick"
                            checked={form.is_learning_pick}
                            onCheckedChange={(c) =>
                              setField("is_learning_pick", c === true)
                            }
                          />
                          <Label htmlFor="is_learning_pick" className="font-normal">
                            학습자료
                          </Label>
                        </div>
                      </FieldRow>

                      <FieldRow label="상태">
                        <Select
                          value={form.status}
                          onValueChange={(v) => setField("status", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="archive">archive · 아카이브</SelectItem>
                            <SelectItem value="coursework_candidate">
                              coursework_candidate · 수업자료 후보
                            </SelectItem>
                            <SelectItem value="experiment_candidate">
                              experiment_candidate · 본실험 후보
                            </SelectItem>
                            <SelectItem value="locked">locked · 본실험 확정</SelectItem>
                            <SelectItem value="excluded">excluded · 제외</SelectItem>
                          </SelectContent>
                        </Select>
                      </FieldRow>

                      <FieldRow label="연구자 메모" htmlFor="researcher_notes">
                        <Textarea
                          id="researcher_notes"
                          rows={3}
                          placeholder="연구자 메모 (선택)"
                          className="min-h-[88px]"
                          value={form.researcher_notes}
                          onChange={(e) => setField("researcher_notes", e.target.value)}
                        />
                      </FieldRow>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3 border-t border-border pt-6">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    취소
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#FAD338] text-[#15202B] hover:bg-[#f0c722]"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-center gap-2 border-b border-border pb-2">
            <span aria-hidden className="inline-block h-4 w-[3px] rounded-sm bg-[#FAD338]" />
            <h2 className="text-base font-semibold text-foreground">등록된 자료</h2>
          </div>

          {items === null ? (
            <p className="text-sm text-muted-foreground">자료를 불러오는 중입니다.</p>
          ) : listError ? (
            <p className="text-sm text-[#D14343]">{listError}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 등록된 자료가 없습니다. 위 폼에서 자료를 등록해 주세요.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => {
                const tags = [it.speech_act, it.discourse_genre, it.sector].filter(
                  (t): t is string => !!t,
                );
                const statusKey = it.status ?? "archive";
                const statusLabel = STATUS_LABELS[statusKey] ?? statusKey;
                const statusClass =
                  STATUS_STYLES[statusKey] ?? "bg-[#E5E5E5] text-[#444]";
                const modeClass =
                  MODE_STYLES[it.mode] ?? "bg-muted text-foreground";
                return (
                  <article
                    key={it.id}
                    className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <h3
                      className="text-base font-semibold leading-snug text-foreground"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {it.title}
                    </h3>

                    <div className="mt-2">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${modeClass}`}
                      >
                        {it.mode}
                      </span>
                    </div>

                    {tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[#EFEAE0] px-2 py-0.5 text-[11px] text-[#5A5343]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {it.difficulty && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        난이도 · {it.difficulty}
                      </p>
                    )}

                    {it.source_text && (
                      <p
                        className="mt-3 text-xs leading-relaxed text-muted-foreground"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {it.source_text}
                      </p>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-[11px]">
                        {it.is_learning_pick ? (
                          <span className="rounded-md bg-[#FFF6D6] px-2 py-0.5 text-[#7a5e00]">
                            ★ 학습자료 후보
                          </span>
                        ) : (
                          <span className="text-transparent">·</span>
                        )}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${statusClass}`}
                      >
                        {statusKey} · {statusLabel}
                      </span>
                    </div>
                    {it.updated_at && (
                      <p className="mt-2 text-right text-[10px] text-muted-foreground">
                        {formatUpdatedAt(it.updated_at)}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminArchive;
