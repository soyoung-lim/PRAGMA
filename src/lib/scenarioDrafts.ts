import { useSyncExternalStore } from "react";

export interface DraftScenario {
  id: string;
  title: string;
  source_text: string;
  task: string;
  variants: { label: string; note: string; text: string }[];
  feedback: { icon: string; role: string; text: string }[];
  speech_act: "request" | "refusal";
  genre: "business_email" | "business_messenger" | "meeting_speech";
  learner_level: "beginner_intermediate" | "intermediate" | "advanced";
  industry_sector:
    | "trade_distribution"
    | "IT_platform"
    | "manufacturing"
    | "tourism_hospitality"
    | "education_research"
    | "public_international_affairs"
    | "culture_content_media";
  business_function:
    | "overseas_sales"
    | "marketing_pr"
    | "customer_partner_support"
    | "SCM_logistics"
    | "contract_terms"
    | "project_coordination"
    | "research_admin"
    | "localization_translation"
    | "event_operations"
    | "international_collaboration";
  interaction_context: "coordination" | "negotiation" | "follow_up";
  auto_check_result: "pass" | "warning" | "fail";
  review_status: "needs_review";
  usage_assignment: "archived_only";
  created_at: string;
  updated_at: string;
}

let drafts: DraftScenario[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function addDraftScenario(d: DraftScenario) {
  drafts = [d, ...drafts];
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return drafts;
}

export function useDraftScenarios() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}