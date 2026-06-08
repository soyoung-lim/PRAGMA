export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      archive_items: {
        Row: {
          audio_url: string | null
          created_at: string | null
          difficulty: string | null
          discourse_genre: string | null
          id: string
          is_learning_pick: boolean | null
          item_type: string | null
          mode: string
          researcher_notes: string | null
          sector: string | null
          source_origin: string | null
          source_text: string | null
          speech_act: string | null
          status: string | null
          title: string
          title_auto_generated: boolean | null
          topic: string | null
          updated_at: string | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          difficulty?: string | null
          discourse_genre?: string | null
          id?: string
          is_learning_pick?: boolean | null
          item_type?: string | null
          mode: string
          researcher_notes?: string | null
          sector?: string | null
          source_origin?: string | null
          source_text?: string | null
          speech_act?: string | null
          status?: string | null
          title: string
          title_auto_generated?: boolean | null
          topic?: string | null
          updated_at?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          difficulty?: string | null
          discourse_genre?: string | null
          id?: string
          is_learning_pick?: boolean | null
          item_type?: string | null
          mode?: string
          researcher_notes?: string | null
          sector?: string | null
          source_origin?: string | null
          source_text?: string | null
          speech_act?: string | null
          status?: string | null
          title?: string
          title_auto_generated?: boolean | null
          topic?: string | null
          updated_at?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      decision_traces: {
        Row: {
          auth_user_id: string
          choice_reason_legacy: string | null
          created_at: string
          decision_trace_complete: boolean | null
          feedback_legacy: Json | null
          final_justification: string | null
          final_translation: string | null
          genre: string | null
          id: string
          language_direction: string | null
          pdr_response: Json | null
          profile_id: string
          scenario_id: string | null
          scenario_key: string
          selected_best_option_id: string | null
          selected_worst_option_id: string | null
          session_id: string | null
          speech_act: string
          submitted_at: string | null
          task_mode: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          choice_reason_legacy?: string | null
          created_at?: string
          decision_trace_complete?: boolean | null
          feedback_legacy?: Json | null
          final_justification?: string | null
          final_translation?: string | null
          genre?: string | null
          id?: string
          language_direction?: string | null
          pdr_response?: Json | null
          profile_id: string
          scenario_id?: string | null
          scenario_key: string
          selected_best_option_id?: string | null
          selected_worst_option_id?: string | null
          session_id?: string | null
          speech_act: string
          submitted_at?: string | null
          task_mode?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          choice_reason_legacy?: string | null
          created_at?: string
          decision_trace_complete?: boolean | null
          feedback_legacy?: Json | null
          final_justification?: string | null
          final_translation?: string | null
          genre?: string | null
          id?: string
          language_direction?: string | null
          pdr_response?: Json | null
          profile_id?: string
          scenario_id?: string | null
          scenario_key?: string
          selected_best_option_id?: string | null
          selected_worst_option_id?: string | null
          session_id?: string | null
          speech_act?: string
          submitted_at?: string | null
          task_mode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_traces_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_year_or_program: string | null
          affiliation_or_status: string | null
          ai_prompting_style_for_ti: string | null
          anonymization_notice_confirmed: boolean
          anonymous_participant_id: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience: string | null
          chinese_proficiency_self_report: string | null
          created_at: string
          email: string | null
          full_name: string | null
          genai_use_frequency: string | null
          id: string
          language_background: string | null
          perceived_ai_ti_difficulty: string | null
          perceived_business_chinese_ti_risk: string | null
          profile_completed: boolean
          report_email_consent: boolean | null
          research_use_consent: boolean
          role: Database["public"]["Enums"]["app_role"]
          ti_experience_level: string | null
          ti_experience_modes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year_or_program?: string | null
          affiliation_or_status?: string | null
          ai_prompting_style_for_ti?: string | null
          anonymization_notice_confirmed?: boolean
          anonymous_participant_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience?: string | null
          chinese_proficiency_self_report?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          genai_use_frequency?: string | null
          id?: string
          language_background?: string | null
          perceived_ai_ti_difficulty?: string | null
          perceived_business_chinese_ti_risk?: string | null
          profile_completed?: boolean
          report_email_consent?: boolean | null
          research_use_consent?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          ti_experience_level?: string | null
          ti_experience_modes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year_or_program?: string | null
          affiliation_or_status?: string | null
          ai_prompting_style_for_ti?: string | null
          anonymization_notice_confirmed?: boolean
          anonymous_participant_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience?: string | null
          chinese_proficiency_self_report?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          genai_use_frequency?: string | null
          id?: string
          language_background?: string | null
          perceived_ai_ti_difficulty?: string | null
          perceived_business_chinese_ti_risk?: string | null
          profile_completed?: boolean
          report_email_consent?: boolean | null
          research_use_consent?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          ti_experience_level?: string | null
          ti_experience_modes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scenario_feedback: {
        Row: {
          created_at: string | null
          feedback_id: string
          field_expert_perspective: string | null
          recipient_perspective: string | null
          scenario_id: string | null
          teacher_perspective: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_id?: string
          field_expert_perspective?: string | null
          recipient_perspective?: string | null
          scenario_id?: string | null
          teacher_perspective?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_id?: string
          field_expert_perspective?: string | null
          recipient_perspective?: string | null
          scenario_id?: string | null
          teacher_perspective?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenario_feedback_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      scenarios: {
        Row: {
          auto_check_result:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function: string | null
          created_at: string | null
          genre: string | null
          industry_sector: string | null
          interaction_context: string | null
          learner_level: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          scenario_id: string
          source_text: string | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          title: string
          topic: string | null
          updated_at: string | null
          usage_assignment: Database["public"]["Enums"]["usage_assignment"]
        }
        Insert: {
          auto_check_result?:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function?: string | null
          created_at?: string | null
          genre?: string | null
          industry_sector?: string | null
          interaction_context?: string | null
          learner_level?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          scenario_id?: string
          source_text?: string | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          title: string
          topic?: string | null
          updated_at?: string | null
          usage_assignment?: Database["public"]["Enums"]["usage_assignment"]
        }
        Update: {
          auto_check_result?:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function?: string | null
          created_at?: string | null
          genre?: string | null
          industry_sector?: string | null
          interaction_context?: string | null
          learner_level?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          scenario_id?: string
          source_text?: string | null
          speech_act?: Database["public"]["Enums"]["speech_act"]
          title?: string
          topic?: string | null
          updated_at?: string | null
          usage_assignment?: Database["public"]["Enums"]["usage_assignment"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "learner" | "admin"
      approval_status: "pending_approval" | "approved" | "rejected" | "inactive"
      auto_check_result: "pass" | "warning" | "fail"
      review_status:
        | "generated"
        | "needs_review"
        | "revise_required"
        | "revised"
        | "approved"
      speech_act: "request" | "refusal"
      usage_assignment:
        | "archived_only"
        | "coursework_published"
        | "experiment_locked"
        | "excluded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["learner", "admin"],
      approval_status: ["pending_approval", "approved", "rejected", "inactive"],
      auto_check_result: ["pass", "warning", "fail"],
      review_status: [
        "generated",
        "needs_review",
        "revise_required",
        "revised",
        "approved",
      ],
      speech_act: ["request", "refusal"],
      usage_assignment: [
        "archived_only",
        "coursework_published",
        "experiment_locked",
        "excluded",
      ],
    },
  },
} as const
