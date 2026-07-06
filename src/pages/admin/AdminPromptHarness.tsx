import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

type PromptTemplate = {
  id: string;
  prompt_key: string;
  title: string | null;
  content: string;
  category: string | null;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  prompt_key: string;
  title: string;
  category: string;
  content: string;
  notes: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  prompt_key: "",
  title: "",
  category: "",
  content: "",
  notes: "",
  is_active: true,
};

const GROUP_ORDER = ["generation", "review", "report", "golden_fta"] as const;

const CATEGORY_TO_GROUP: Record<string, (typeof GROUP_ORDER)[number]> = {
  generation: "generation",
  review: "review",
  report: "report",
  golden: "golden_fta",
  fta: "golden_fta",
};

const GROUP_LABEL: Record<(typeof GROUP_ORDER)[number], string> = {
  generation: "① 시나리오 생성",
  review: "② 품질 검수",
  report: "③ 수행 리포트",
  golden_fta: "④ 기준 자료",
};

const GROUP_DESCRIPTION: Record<(typeof GROUP_ORDER)[number], string> = {
  generation: "AI가 상황 시나리오·번역 후보를 만들 때 지켜야 할 규칙",
  review: "생성된 결과를 학습자에게보내기 전에 점검하는 기준",
  report: "학습자의 수행 기록을 분석해 강약점·다음 학습을 정리하는 틀",
  golden_fta: "생성·검수의 기준이 되는 모범 사례와 이론적 설계 근거",
};

const CARD_ORDER: Record<string, number> = {
  metadata_lock_block: 1,
  source_text_responsibility_block: 2,
  candidate_contrast_block: 3,
  reviewer_checklist_block: 4,
  report_schema_block: 5,
  golden_examples: 6,
  fta_design_note: 7,
};

const CARD_DISPLAY: Record<
  string,
  { title: string; subtitle: string }
> = {
  metadata_lock_block: {
    title: "입력 조건 고정",
    subtitle:
      "화행·상황·수준 등 관리자가 정한 조건이 생성 중 바뀌지 않도록 고정",
  },
  source_text_responsibility_block: {
    title: "원문 충실성 규칙",
    subtitle: "원문에 없는 사실·사과·약속을 지어내지 않도록 통제",
  },
  candidate_contrast_block: {
    title: "번역 후보 대비 설계",
    subtitle:
      "직접성 차이로 여러 후보를 만들어 학습자가 화용 차이를 판단하게 함",
  },
  reviewer_checklist_block: {
    title: "검수 점검표",
    subtitle: "생성 결과가 기준을 지켰는지 항목별로 점검",
  },
  report_schema_block: {
    title: "리포트 구조 틀",
    subtitle: "수행 기록 기반 강약점·추천의 출력 형식",
  },
  golden_examples: {
    title: "모범·오류 예시",
    subtitle: "통과·실패·수정 사례 모음",
  },
  fta_design_note: {
    title: "상황·공손성 설계 노트",
    subtitle:
      "상황 변수(P/D/R)와 번역 직접성을 잇는 이론적 설계 근거",
  },
};

function sortByDisplayOrder(rows: PromptTemplate[]): PromptTemplate[] {
  return [...rows].sort((a, b) => {
    const ao = CARD_ORDER[a.prompt_key] ?? 99;
    const bo = CARD_ORDER[b.prompt_key] ?? 99;
    if (ao !== bo) return ao - bo;
    return (a.prompt_key ?? "").localeCompare(b.prompt_key ?? "");
  });
}


const AdminPromptHarness = () => {
  const [rows, setRows] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromptTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .order("category", { ascending: true, nullsFirst: false })
      .order("prompt_key", { ascending: true })
      .order("version", { ascending: false });
    if (error) {
      toast.error(`불러오기 실패: ${error.message}`);
      setRows([]);
    } else {
      setRows((data ?? []) as PromptTemplate[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const g: Record<string, PromptTemplate[]> = {};
    for (const r of rows) {
      const k = r.category?.trim() || "기타";
      (g[k] ||= []).push(r);
    }
    return g;
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: PromptTemplate) => {
    setEditing(row);
    setForm({
      id: row.id,
      prompt_key: row.prompt_key,
      title: row.title ?? "",
      category: row.category ?? "",
      content: row.content ?? "",
      notes: row.notes ?? "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.prompt_key.trim()) {
      toast.error("prompt_key는 필수입니다.");
      return;
    }
    if (!form.content) {
      toast.error("content는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("prompt_templates")
          .update({
            prompt_key: form.prompt_key.trim(),
            title: form.title || null,
            category: form.category || null,
            content: form.content,
            notes: form.notes || null,
            is_active: form.is_active,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("수정되었습니다.");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("prompt_templates").insert({
          prompt_key: form.prompt_key.trim(),
          title: form.title || null,
          category: form.category || null,
          content: form.content,
          notes: form.notes || null,
          is_active: form.is_active,
          version: 1,
          created_by: userData.user?.id ?? null,
        });
        if (error) throw error;
        toast.success("추가되었습니다.");
      }
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error(`삭제 실패: ${error.message}`);
    } else {
      toast.success("삭제되었습니다.");
      await load();
    }
    setDeleteTarget(null);
  };

  return (
    <AdminShell
      title="프롬프트 관리"
      description="AI가 학습 자료를 생성·검수·분석할 때 지키는 규칙과 기준을 단계별로 관리합니다. 각 규칙은 버전으로 관리되며, 지금은 규칙을 정리·보관하는 단계입니다."
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          총 {rows.length}개 · 단계 {GROUP_ORDER.length}개
        </p>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> 새 프롬프트 추가
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          등록된 프롬프트가 없습니다.
        </div>
      ) : (
        <div className="space-y-8">
          {GROUP_ORDER.map((groupKey) => {
            const items = grouped[groupKey];
            if (!items || items.length === 0) return null;
            return (
              <div key={groupKey}>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    {GROUP_LABEL[groupKey]}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {GROUP_DESCRIPTION[groupKey]}
                  </p>
                </div>
                <div className="space-y-2">
                  {items.map((row) => {
                    const isOpen = !!expanded[row.id];
                    const display = CARD_DISPLAY[row.prompt_key];
                    const displayTitle =
                      display?.title || row.title || row.prompt_key;
                    return (
                      <Card key={row.id}>
                        <CardHeader className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpanded((s) => ({ ...s, [row.id]: !isOpen }))
                                  }
                                  className="flex items-center gap-1 text-left"
                                >
                                  {isOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <CardTitle className="text-base">
                                    {displayTitle}
                                  </CardTitle>
                                </button>
                                <Badge variant="outline" className="font-mono text-[11px]">
                                  {row.prompt_key}
                                </Badge>
                                <Badge variant="secondary">v{row.version}</Badge>
                                <Badge variant={row.is_active ? "default" : "outline"}>
                                  {row.is_active ? "활성" : "비활성"}
                                </Badge>
                              </div>
                              {display?.subtitle && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {display.subtitle}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-muted-foreground">
                                업데이트: {new Date(row.updated_at).toLocaleString()}
                              </p>
                            </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {isOpen && (
                        <CardContent className="p-4 pt-0">
                          <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                            {row.content || "(비어 있음)"}
                          </pre>
                          {row.notes && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              메모: {row.notes}
                            </p>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "프롬프트 수정" : "새 프롬프트 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>prompt_key *</Label>
              <Input
                value={form.prompt_key}
                onChange={(e) => setForm((f) => ({ ...f, prompt_key: e.target.value }))}
                placeholder="예: metadata_lock_block"
              />
            </div>
            <div>
              <Label>title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="사람이 읽는 제목"
              />
            </div>
            <div>
              <Label>category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="generation / review / report / fta / golden 등"
              />
            </div>
            <div>
              <Label>content *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label>활성 (is_active)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 프롬프트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.prompt_key} (v{deleteTarget?.version}) 를 영구 삭제합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
};

export default AdminPromptHarness;
