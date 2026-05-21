import { useState } from "react";
import { toast } from "sonner";
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
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className="text-sm text-foreground">
      {label}
      {required && <Required />}
    </Label>
    {children}
  </div>
);

const AdminArchive = () => {
  const [open, setOpen] = useState(false);

  const handleCancel = () => setOpen(false);
  const handleSave = () =>
    toast("저장 동작은 다음 단계에서 구현됩니다");
  const handleAiTitle = () => toast("후속 구현 예정");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-[#15202B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-base font-medium text-[#F1EFE8] sm:text-lg">
            <span aria-hidden className="inline-block h-4 w-[2px] rounded-full bg-[#FAD338]" />
            통번역 데이터 아카이브
          </span>
          <span className="rounded-md border border-[#5C6A7A] bg-transparent px-3 py-1.5 text-sm font-medium text-[#F1EFE8]">
            관리자 영역
          </span>
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
                      <FieldRow label="제목" required htmlFor="title">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input id="title" placeholder="자료 제목" />
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

                      <FieldRow label="모드" required>
                        <RadioGroup defaultValue="번역" className="flex gap-6 pt-1">
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
                        <Input id="topic" placeholder="예: 신제품 출시 회의" />
                      </FieldRow>

                      <FieldRow label="자료 유형" htmlFor="item_type">
                        <Input id="item_type" placeholder="예: dialogue, email, monologue" />
                      </FieldRow>

                      <FieldRow label="난이도">
                        <Select>
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
                        <Select>
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
                        <Select>
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
                        <Select>
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
                        />
                      </FieldRow>

                      <FieldRow label="자료 출처">
                        <Select defaultValue="manual">
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
                        <Input id="audio_url" type="url" placeholder="https://..." />
                      </FieldRow>

                      <FieldRow label="YouTube URL" htmlFor="youtube_url">
                        <Input id="youtube_url" type="url" placeholder="https://www.youtube.com/watch?v=..." />
                      </FieldRow>

                      <FieldRow label="YouTube ID" htmlFor="youtube_id">
                        <Input id="youtube_id" placeholder="예: dQw4w9WgXcQ" />
                      </FieldRow>
                    </div>
                  </div>

                  {/* Group 4 */}
                  <div>
                    <SectionHeader title="운영 태그" />
                    <div className="space-y-5">
                      <FieldRow label="학습자료 후보">
                        <div className="flex items-center gap-2 pt-1">
                          <Checkbox id="is_learning_pick" />
                          <Label htmlFor="is_learning_pick" className="font-normal">
                            학습자료
                          </Label>
                        </div>
                      </FieldRow>

                      <FieldRow label="상태">
                        <Select defaultValue="archive">
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
                    className="bg-[#FAD338] text-[#15202B] hover:bg-[#f0c722]"
                  >
                    저장
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AdminArchive;
