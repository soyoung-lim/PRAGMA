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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      assessment_form_items: {
        Row: {
          created_at: string
          form_id: string
          id: string
          position: number
          scenario_id: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          position?: number
          scenario_id: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          position?: number
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_form_items_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "assessment_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_form_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      assessment_forms: {
        Row: {
          cohort_id: string | null
          created_at: string
          form_id: string
          form_ver: string
          id: string
          measurement_point: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          form_id: string
          form_ver?: string
          id?: string
          measurement_point: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          form_id?: string
          form_ver?: string
          id?: string
          measurement_point?: string
        }
        Relationships: []
      }
      course_week_package_assignments: {
        Row: {
          course_week: number
          created_at: string
          id: string
          package_id: string
          sequence: number
        }
        Insert: {
          course_week: number
          created_at?: string
          id?: string
          package_id: string
          sequence?: number
        }
        Update: {
          course_week?: number
          created_at?: string
          id?: string
          package_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_week_package_assignments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "feature_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      course_weeks: {
        Row: {
          course_phase: string
          created_at: string
          detail_topic: string
          display_order: number
          id: string
          is_exam_week: boolean
          is_onboarding_week: boolean
          lecture_topic: string | null
          updated_at: string
          week_no: number
        }
        Insert: {
          course_phase: string
          created_at?: string
          detail_topic: string
          display_order: number
          id?: string
          is_exam_week?: boolean
          is_onboarding_week?: boolean
          lecture_topic?: string | null
          updated_at?: string
          week_no: number
        }
        Update: {
          course_phase?: string
          created_at?: string
          detail_topic?: string
          display_order?: number
          id?: string
          is_exam_week?: boolean
          is_onboarding_week?: boolean
          lecture_topic?: string | null
          updated_at?: string
          week_no?: number
        }
        Relationships: []
      }
      curriculum_outlines: {
        Row: {
          composition_theme_codes: string[]
          created_at: string
          domain: string
          final_week: number | null
          id: string
          industry: string | null
          language_direction: string
          level: string
          midterm_week: number | null
          scenarios_per_week: number
          semester_goal: string | null
          status: string
          target_interpreting_ratio: number
          target_speech_acts: string[]
          title: string
          updated_at: string
          week_count: number
        }
        Insert: {
          composition_theme_codes?: string[]
          created_at?: string
          domain: string
          final_week?: number | null
          id?: string
          industry?: string | null
          language_direction: string
          level: string
          midterm_week?: number | null
          scenarios_per_week?: number
          semester_goal?: string | null
          status?: string
          target_interpreting_ratio?: number
          target_speech_acts?: string[]
          title: string
          updated_at?: string
          week_count?: number
        }
        Update: {
          composition_theme_codes?: string[]
          created_at?: string
          domain?: string
          final_week?: number | null
          id?: string
          industry?: string | null
          language_direction?: string
          level?: string
          midterm_week?: number | null
          scenarios_per_week?: number
          semester_goal?: string | null
          status?: string
          target_interpreting_ratio?: number
          target_speech_acts?: string[]
          title?: string
          updated_at?: string
          week_count?: number
        }
        Relationships: []
      }
      curriculum_week_scenarios: {
        Row: {
          created_at: string
          id: string
          outline_id: string
          position: number
          scenario_id: string
          slot_role: string
          updated_at: string
          week_no: number
        }
        Insert: {
          created_at?: string
          id?: string
          outline_id: string
          position?: number
          scenario_id: string
          slot_role?: string
          updated_at?: string
          week_no: number
        }
        Update: {
          created_at?: string
          id?: string
          outline_id?: string
          position?: number
          scenario_id?: string
          slot_role?: string
          updated_at?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_week_scenarios_outline_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "curriculum_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_week_scenarios_scenario_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      curriculum_weeks: {
        Row: {
          can_do: string[] | null
          channel: string | null
          competency_focus: string | null
          created_at: string
          curriculum_load_band: number | null
          domain: string | null
          id: string
          industry: string | null
          outline_id: string
          pdr_distance: string | null
          pdr_imposition: string | null
          pdr_power: string | null
          review_released: boolean
          scenario_slots: number | null
          speech_act: string | null
          title: string | null
          type: string
          updated_at: string
          week_no: number
        }
        Insert: {
          can_do?: string[] | null
          channel?: string | null
          competency_focus?: string | null
          created_at?: string
          curriculum_load_band?: number | null
          domain?: string | null
          id?: string
          industry?: string | null
          outline_id: string
          pdr_distance?: string | null
          pdr_imposition?: string | null
          pdr_power?: string | null
          review_released?: boolean
          scenario_slots?: number | null
          speech_act?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          week_no: number
        }
        Update: {
          can_do?: string[] | null
          channel?: string | null
          competency_focus?: string | null
          created_at?: string
          curriculum_load_band?: number | null
          domain?: string | null
          id?: string
          industry?: string | null
          outline_id?: string
          pdr_distance?: string | null
          pdr_imposition?: string | null
          pdr_power?: string | null
          review_released?: boolean
          scenario_slots?: number | null
          speech_act?: string | null
          title?: string | null
          type?: string
          updated_at?: string
          week_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_weeks_outline_id_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "curriculum_outlines"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_traces: {
        Row: {
          auth_user_id: string
          best_choice_reason: string | null
          choice_reason_legacy: string | null
          created_at: string
          decision_trace_complete: boolean | null
          feedback_decisions: Json | null
          feedback_legacy: Json | null
          final_justification: string | null
          final_translation: string | null
          genre: string | null
          id: string
          language_direction: string | null
          option_display_mapping: Json | null
          pdr_response: Json | null
          profile_id: string
          scenario_id: string | null
          scenario_key: string
          selected_best_option_id: string | null
          selected_worst_option_id: string | null
          session_id: string | null
          speech_act: string
          student_proposal_reason_pre_feedback: string | null
          student_proposed_translation_pre_feedback: string | null
          submitted_at: string | null
          task_mode: string | null
          updated_at: string
          worst_choice_reason: string | null
        }
        Insert: {
          auth_user_id: string
          best_choice_reason?: string | null
          choice_reason_legacy?: string | null
          created_at?: string
          decision_trace_complete?: boolean | null
          feedback_decisions?: Json | null
          feedback_legacy?: Json | null
          final_justification?: string | null
          final_translation?: string | null
          genre?: string | null
          id?: string
          language_direction?: string | null
          option_display_mapping?: Json | null
          pdr_response?: Json | null
          profile_id: string
          scenario_id?: string | null
          scenario_key: string
          selected_best_option_id?: string | null
          selected_worst_option_id?: string | null
          session_id?: string | null
          speech_act: string
          student_proposal_reason_pre_feedback?: string | null
          student_proposed_translation_pre_feedback?: string | null
          submitted_at?: string | null
          task_mode?: string | null
          updated_at?: string
          worst_choice_reason?: string | null
        }
        Update: {
          auth_user_id?: string
          best_choice_reason?: string | null
          choice_reason_legacy?: string | null
          created_at?: string
          decision_trace_complete?: boolean | null
          feedback_decisions?: Json | null
          feedback_legacy?: Json | null
          final_justification?: string | null
          final_translation?: string | null
          genre?: string | null
          id?: string
          language_direction?: string | null
          option_display_mapping?: Json | null
          pdr_response?: Json | null
          profile_id?: string
          scenario_id?: string | null
          scenario_key?: string
          selected_best_option_id?: string | null
          selected_worst_option_id?: string | null
          session_id?: string | null
          speech_act?: string
          student_proposal_reason_pre_feedback?: string | null
          student_proposed_translation_pre_feedback?: string | null
          submitted_at?: string | null
          task_mode?: string | null
          updated_at?: string
          worst_choice_reason?: string | null
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
      feature_packages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          generation_model: string | null
          generation_prompt_ver: string | null
          id: string
          intro_hook: Json | null
          mpj_items: Json | null
          mpj_labels: Json | null
          package_ver: string
          ref_cases: Json | null
          review_warnings: Json | null
          reviewer_model: string | null
          reviewer_prompt_ver: string | null
          rule_check_result: Json | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          status: Database["public"]["Enums"]["review_status"]
          target_feature: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generation_model?: string | null
          generation_prompt_ver?: string | null
          id?: string
          intro_hook?: Json | null
          mpj_items?: Json | null
          mpj_labels?: Json | null
          package_ver?: string
          ref_cases?: Json | null
          review_warnings?: Json | null
          reviewer_model?: string | null
          reviewer_prompt_ver?: string | null
          rule_check_result?: Json | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          status?: Database["public"]["Enums"]["review_status"]
          target_feature: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generation_model?: string | null
          generation_prompt_ver?: string | null
          id?: string
          intro_hook?: Json | null
          mpj_items?: Json | null
          mpj_labels?: Json | null
          package_ver?: string
          ref_cases?: Json | null
          review_warnings?: Json | null
          reviewer_model?: string | null
          reviewer_prompt_ver?: string | null
          rule_check_result?: Json | null
          speech_act?: Database["public"]["Enums"]["speech_act"]
          status?: Database["public"]["Enums"]["review_status"]
          target_feature?: string
          updated_at?: string
        }
        Relationships: []
      }
      hsk_reference_sources: {
        Row: {
          created_at: string
          effective_at: string | null
          extraction_version: string
          id: string
          manifest_version: string
          notes: string | null
          official_url: string
          publisher: string
          released_at: string | null
          sha256: string
          title: string
        }
        Insert: {
          created_at?: string
          effective_at?: string | null
          extraction_version: string
          id: string
          manifest_version: string
          notes?: string | null
          official_url: string
          publisher: string
          released_at?: string | null
          sha256: string
          title: string
        }
        Update: {
          created_at?: string
          effective_at?: string | null
          extraction_version?: string
          id?: string
          manifest_version?: string
          notes?: string | null
          official_url?: string
          publisher?: string
          released_at?: string | null
          sha256?: string
          title?: string
        }
        Relationships: []
      }
      hsk_vocab: {
        Row: {
          created_at: string
          hsk_level: number
          id: string
          pinyin: string | null
          pos: string | null
          source: string | null
          word: string
        }
        Insert: {
          created_at?: string
          hsk_level: number
          id?: string
          pinyin?: string | null
          pos?: string | null
          source?: string | null
          word: string
        }
        Update: {
          created_at?: string
          hsk_level?: number
          id?: string
          pinyin?: string | null
          pos?: string | null
          source?: string | null
          word?: string
        }
        Relationships: []
      }
      hsk3_topic_derivations: {
        Row: {
          appears_in_levels: number[]
          created_at: string
          derivation_version: string
          has_explicit_open_marker: boolean
          l3_terms: string[]
          n_levels: number
          n_terms: number
          path: string
          source_id: string
          topic_seq: number
        }
        Insert: {
          appears_in_levels: number[]
          created_at?: string
          derivation_version: string
          has_explicit_open_marker: boolean
          l3_terms: string[]
          n_levels: number
          n_terms: number
          path: string
          source_id: string
          topic_seq: number
        }
        Update: {
          appears_in_levels?: number[]
          created_at?: string
          derivation_version?: string
          has_explicit_open_marker?: boolean
          l3_terms?: string[]
          n_levels?: number
          n_terms?: number
          path?: string
          source_id?: string
          topic_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "hsk3_topic_derivations_source_id_topic_seq_fkey"
            columns: ["source_id", "topic_seq"]
            isOneToOne: false
            referencedRelation: "hsk3_topics"
            referencedColumns: ["source_id", "topic_seq"]
          },
        ]
      }
      hsk3_topics: {
        Row: {
          l1: string
          l2: string
          l3: string
          level_band: string
          level_int: number
          source_id: string
          topic_seq: number
        }
        Insert: {
          l1: string
          l2: string
          l3: string
          level_band: string
          level_int: number
          source_id: string
          topic_seq: number
        }
        Update: {
          l1?: string
          l2?: string
          l3?: string
          level_band?: string
          level_int?: number
          source_id?: string
          topic_seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "hsk3_topics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hsk_reference_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hsk3_topics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hsk3_reference_status"
            referencedColumns: ["source_id"]
          },
        ]
      }
      hsk3_vocab: {
        Row: {
          extra_levels: number[]
          headword: string
          intro_band: string
          intro_level: number
          is_multi_sense: boolean
          is_phrase: boolean
          is_polyphone: boolean
          pinyin: string
          pinyin_norm: string
          pos: string | null
          sense_no: number
          seq: number
          source_form: string
          source_id: string
          source_note: string | null
        }
        Insert: {
          extra_levels?: number[]
          headword: string
          intro_band: string
          intro_level: number
          is_multi_sense?: boolean
          is_phrase?: boolean
          is_polyphone?: boolean
          pinyin: string
          pinyin_norm: string
          pos?: string | null
          sense_no?: number
          seq: number
          source_form: string
          source_id: string
          source_note?: string | null
        }
        Update: {
          extra_levels?: number[]
          headword?: string
          intro_band?: string
          intro_level?: number
          is_multi_sense?: boolean
          is_phrase?: boolean
          is_polyphone?: boolean
          pinyin?: string
          pinyin_norm?: string
          pos?: string | null
          sense_no?: number
          seq?: number
          source_form?: string
          source_id?: string
          source_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hsk3_vocab_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hsk_reference_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hsk3_vocab_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hsk3_reference_status"
            referencedColumns: ["source_id"]
          },
        ]
      }
      learner_mission_events: {
        Row: {
          attempt_id: string
          auth_user_id: string
          consent_version: string
          content_hash: string | null
          content_version: string | null
          direction: string | null
          event_payload: Json
          event_seq: number
          event_type: string
          feature_id: string | null
          id: string
          lineage_version_id: string | null
          mission_id: string
          occurred_at: string
          policy_version: string
          profile_id: string
          recorded_at: string
          scenario_id: string | null
          speech_act: string | null
          task_mode: string | null
        }
        Insert: {
          attempt_id: string
          auth_user_id: string
          consent_version: string
          content_hash?: string | null
          content_version?: string | null
          direction?: string | null
          event_payload?: Json
          event_seq: number
          event_type: string
          feature_id?: string | null
          id?: string
          lineage_version_id?: string | null
          mission_id: string
          occurred_at: string
          policy_version: string
          profile_id: string
          recorded_at?: string
          scenario_id?: string | null
          speech_act?: string | null
          task_mode?: string | null
        }
        Update: {
          attempt_id?: string
          auth_user_id?: string
          consent_version?: string
          content_hash?: string | null
          content_version?: string | null
          direction?: string | null
          event_payload?: Json
          event_seq?: number
          event_type?: string
          feature_id?: string | null
          id?: string
          lineage_version_id?: string | null
          mission_id?: string
          occurred_at?: string
          policy_version?: string
          profile_id?: string
          recorded_at?: string
          scenario_id?: string | null
          speech_act?: string | null
          task_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_mission_events_lineage_version_id_fkey"
            columns: ["lineage_version_id"]
            isOneToOne: false
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_mission_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_mission_events_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      learner_mission_logs: {
        Row: {
          auth_user_id: string
          cell_id: string | null
          cohort_id: string | null
          completed_at: string | null
          consent_version: string | null
          content_ver: string | null
          context_judgment: Json | null
          created_at: string
          example_shown: boolean | null
          feature_id: string | null
          first_response: string | null
          form_id: string | null
          form_order: string | null
          hint_used: boolean | null
          id: string
          level: string | null
          measurement_point: string | null
          mission_completed: boolean | null
          mission_id: string
          mode: string
          package_id: string | null
          policy_ver: string | null
          profile_id: string
          revised_response: string | null
          revision_target_selected: string | null
          revision_target_source: string | null
          self_confidence_rating: number | null
          semantic_fidelity_status: string | null
          source_lang: string | null
          source_text: string | null
          speech_act: string | null
          started_at: string | null
          study_id: string | null
          target_feature_observed: Json | null
          target_lang: string | null
          task_type: string | null
          transfer_response: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          cell_id?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          consent_version?: string | null
          content_ver?: string | null
          context_judgment?: Json | null
          created_at?: string
          example_shown?: boolean | null
          feature_id?: string | null
          first_response?: string | null
          form_id?: string | null
          form_order?: string | null
          hint_used?: boolean | null
          id?: string
          level?: string | null
          measurement_point?: string | null
          mission_completed?: boolean | null
          mission_id: string
          mode: string
          package_id?: string | null
          policy_ver?: string | null
          profile_id: string
          revised_response?: string | null
          revision_target_selected?: string | null
          revision_target_source?: string | null
          self_confidence_rating?: number | null
          semantic_fidelity_status?: string | null
          source_lang?: string | null
          source_text?: string | null
          speech_act?: string | null
          started_at?: string | null
          study_id?: string | null
          target_feature_observed?: Json | null
          target_lang?: string | null
          task_type?: string | null
          transfer_response?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          cell_id?: string | null
          cohort_id?: string | null
          completed_at?: string | null
          consent_version?: string | null
          content_ver?: string | null
          context_judgment?: Json | null
          created_at?: string
          example_shown?: boolean | null
          feature_id?: string | null
          first_response?: string | null
          form_id?: string | null
          form_order?: string | null
          hint_used?: boolean | null
          id?: string
          level?: string | null
          measurement_point?: string | null
          mission_completed?: boolean | null
          mission_id?: string
          mode?: string
          package_id?: string | null
          policy_ver?: string | null
          profile_id?: string
          revised_response?: string | null
          revision_target_selected?: string | null
          revision_target_source?: string | null
          self_confidence_rating?: number | null
          semantic_fidelity_status?: string | null
          source_lang?: string | null
          source_text?: string | null
          speech_act?: string | null
          started_at?: string | null
          study_id?: string | null
          target_feature_observed?: Json | null
          target_lang?: string | null
          task_type?: string | null
          transfer_response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_mission_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_invocation_events: {
        Row: {
          cached_tokens: number | null
          completion_tokens: number | null
          content_release_id: string | null
          created_at: string
          duration_ms: number
          fallback_from: string | null
          finish_reason: string | null
          generation_item_key: string | null
          generation_run_id: string | null
          id: string
          invocation_attempt: number
          is_model_fallback: boolean
          model_requested: string
          model_returned: string | null
          operation: string
          prompt_snapshot_hash: string | null
          prompt_tokens: number | null
          prompt_version: string | null
          provider: string
          provider_request_id: string | null
          provider_response_id: string | null
          reasoning_tokens: number | null
          request_group_id: string
          scenario_id: string | null
          status_code: number
          success: boolean
          total_tokens: number | null
        }
        Insert: {
          cached_tokens?: number | null
          completion_tokens?: number | null
          content_release_id?: string | null
          created_at?: string
          duration_ms: number
          fallback_from?: string | null
          finish_reason?: string | null
          generation_item_key?: string | null
          generation_run_id?: string | null
          id?: string
          invocation_attempt?: number
          is_model_fallback?: boolean
          model_requested: string
          model_returned?: string | null
          operation: string
          prompt_snapshot_hash?: string | null
          prompt_tokens?: number | null
          prompt_version?: string | null
          provider: string
          provider_request_id?: string | null
          provider_response_id?: string | null
          reasoning_tokens?: number | null
          request_group_id: string
          scenario_id?: string | null
          status_code: number
          success: boolean
          total_tokens?: number | null
        }
        Update: {
          cached_tokens?: number | null
          completion_tokens?: number | null
          content_release_id?: string | null
          created_at?: string
          duration_ms?: number
          fallback_from?: string | null
          finish_reason?: string | null
          generation_item_key?: string | null
          generation_run_id?: string | null
          id?: string
          invocation_attempt?: number
          is_model_fallback?: boolean
          model_requested?: string
          model_returned?: string | null
          operation?: string
          prompt_snapshot_hash?: string | null
          prompt_tokens?: number | null
          prompt_version?: string | null
          provider?: string
          provider_request_id?: string | null
          provider_response_id?: string | null
          reasoning_tokens?: number | null
          request_group_id?: string
          scenario_id?: string | null
          status_code?: number
          success?: boolean
          total_tokens?: number | null
        }
        Relationships: []
      }
      mission_expert_review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          blind_review: boolean
          expert_registry_version_id: string | null
          id: string
          lineage_version_id: string
          protocol_version: string
          review_round: number
          reviewer_user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          blind_review?: boolean
          expert_registry_version_id?: string | null
          id?: string
          lineage_version_id: string
          protocol_version?: string
          review_round?: number
          reviewer_user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          blind_review?: boolean
          expert_registry_version_id?: string | null
          id?: string
          lineage_version_id?: string
          protocol_version?: string
          review_round?: number
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_expert_review_assignmen_expert_registry_version_id_fkey"
            columns: ["expert_registry_version_id"]
            isOneToOne: false
            referencedRelation: "pragma_expert_registry_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_expert_review_assignments_lineage_version_id_fkey"
            columns: ["lineage_version_id"]
            isOneToOne: false
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_expert_reviews: {
        Row: {
          assignment_id: string
          candidate_band_assessments: Json
          confidence: number
          id: string
          independence_declaration: Json | null
          lineage_claim_assessments: Json
          lineage_version_id: string
          overall_verdict: string
          protocol_version: string
          rationale_ko: string
          review_round: number
          reviewer_user_id: string
          rule_findings: Json
          schema_version: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          candidate_band_assessments?: Json
          confidence: number
          id?: string
          independence_declaration?: Json | null
          lineage_claim_assessments?: Json
          lineage_version_id: string
          overall_verdict: string
          protocol_version?: string
          rationale_ko: string
          review_round?: number
          reviewer_user_id: string
          rule_findings?: Json
          schema_version?: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          candidate_band_assessments?: Json
          confidence?: number
          id?: string
          independence_declaration?: Json | null
          lineage_claim_assessments?: Json
          lineage_version_id?: string
          overall_verdict?: string
          protocol_version?: string
          rationale_ko?: string
          review_round?: number
          reviewer_user_id?: string
          rule_findings?: Json
          schema_version?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_expert_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "mission_expert_review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_expert_reviews_lineage_version_id_fkey"
            columns: ["lineage_version_id"]
            isOneToOne: false
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_lineage_versions: {
        Row: {
          actor_id: string | null
          ai_quality_result: Json | null
          coverage_status: string
          created_at: string
          evidence_scope_ids: string[]
          generation_attempt: number | null
          generation_model: string | null
          generation_provider: string | null
          gold_regression_run_id: string | null
          id: string
          item_lineage: Json | null
          mission_content: Json
          mission_content_hash: string | null
          parent_version_id: string | null
          prompt_instance_hash: string | null
          prompt_snapshot_hash: string | null
          prompt_version: string | null
          realization_pack_id: string | null
          realization_pack_version: string | null
          release_resolution_id: string | null
          released_at: string | null
          released_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_scope_ids: string[]
          rule_scope_ids: string[]
          scenario_id: string
          stage: string
          validation_result: Json | null
          version_no: number
        }
        Insert: {
          actor_id?: string | null
          ai_quality_result?: Json | null
          coverage_status?: string
          created_at?: string
          evidence_scope_ids?: string[]
          generation_attempt?: number | null
          generation_model?: string | null
          generation_provider?: string | null
          gold_regression_run_id?: string | null
          id?: string
          item_lineage?: Json | null
          mission_content: Json
          mission_content_hash?: string | null
          parent_version_id?: string | null
          prompt_instance_hash?: string | null
          prompt_snapshot_hash?: string | null
          prompt_version?: string | null
          realization_pack_id?: string | null
          realization_pack_version?: string | null
          release_resolution_id?: string | null
          released_at?: string | null
          released_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_scope_ids?: string[]
          rule_scope_ids?: string[]
          scenario_id: string
          stage: string
          validation_result?: Json | null
          version_no: number
        }
        Update: {
          actor_id?: string | null
          ai_quality_result?: Json | null
          coverage_status?: string
          created_at?: string
          evidence_scope_ids?: string[]
          generation_attempt?: number | null
          generation_model?: string | null
          generation_provider?: string | null
          gold_regression_run_id?: string | null
          id?: string
          item_lineage?: Json | null
          mission_content?: Json
          mission_content_hash?: string | null
          parent_version_id?: string | null
          prompt_instance_hash?: string | null
          prompt_snapshot_hash?: string | null
          prompt_version?: string | null
          realization_pack_id?: string | null
          realization_pack_version?: string | null
          release_resolution_id?: string | null
          released_at?: string | null
          released_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_scope_ids?: string[]
          rule_scope_ids?: string[]
          scenario_id?: string
          stage?: string
          validation_result?: Json | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_lineage_versions_gold_regression_run_id_fkey"
            columns: ["gold_regression_run_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_regression_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_lineage_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_lineage_versions_release_resolution_id_fkey"
            columns: ["release_resolution_id"]
            isOneToOne: false
            referencedRelation: "mission_review_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_lineage_versions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      mission_review_resolution_signoffs: {
        Row: {
          decision: string
          id: string
          rationale_ko: string
          resolution_id: string
          reviewer_user_id: string
          signed_at: string
        }
        Insert: {
          decision: string
          id?: string
          rationale_ko: string
          resolution_id: string
          reviewer_user_id: string
          signed_at?: string
        }
        Update: {
          decision?: string
          id?: string
          rationale_ko?: string
          resolution_id?: string
          reviewer_user_id?: string
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_review_resolution_signoffs_resolution_id_fkey"
            columns: ["resolution_id"]
            isOneToOne: false
            referencedRelation: "mission_review_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_review_resolutions: {
        Row: {
          final_verdict: string | null
          id: string
          lineage_version_id: string
          protocol_version: string
          rationale_ko: string
          resolution_revision: number
          resolution_status: string
          resolved_at: string
          resolved_by: string
          resolved_candidate_bands: Json | null
          resolved_lineage_claims: Json | null
          review_ids: string[]
          review_round: number
          supersedes_resolution_id: string | null
        }
        Insert: {
          final_verdict?: string | null
          id?: string
          lineage_version_id: string
          protocol_version?: string
          rationale_ko: string
          resolution_revision?: number
          resolution_status: string
          resolved_at?: string
          resolved_by: string
          resolved_candidate_bands?: Json | null
          resolved_lineage_claims?: Json | null
          review_ids: string[]
          review_round?: number
          supersedes_resolution_id?: string | null
        }
        Update: {
          final_verdict?: string | null
          id?: string
          lineage_version_id?: string
          protocol_version?: string
          rationale_ko?: string
          resolution_revision?: number
          resolution_status?: string
          resolved_at?: string
          resolved_by?: string
          resolved_candidate_bands?: Json | null
          resolved_lineage_claims?: Json | null
          review_ids?: string[]
          review_round?: number
          supersedes_resolution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_review_resolutions_lineage_version_id_fkey"
            columns: ["lineage_version_id"]
            isOneToOne: false
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_review_resolutions_supersedes_resolution_id_fkey"
            columns: ["supersedes_resolution_id"]
            isOneToOne: false
            referencedRelation: "mission_review_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      package_items: {
        Row: {
          activity_type: string | null
          changed_axis: string | null
          created_at: string
          id: string
          package_id: string
          pair_id: string | null
          pair_role: string | null
          position: number
          scenario_id: string
          slot: string
          task_type: string | null
        }
        Insert: {
          activity_type?: string | null
          changed_axis?: string | null
          created_at?: string
          id?: string
          package_id: string
          pair_id?: string | null
          pair_role?: string | null
          position?: number
          scenario_id: string
          slot: string
          task_type?: string | null
        }
        Update: {
          activity_type?: string | null
          changed_axis?: string | null
          created_at?: string
          id?: string
          package_id?: string
          pair_id?: string | null
          pair_role?: string | null
          position?: number
          scenario_id?: string
          slot?: string
          task_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "feature_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      package_level_variants: {
        Row: {
          created_at: string
          id: string
          level: string
          level_text_variant: Json | null
          package_id: string
          policy_override: Json | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["auto_check_result"]
          variant_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          level_text_variant?: Json | null
          package_id: string
          policy_override?: Json | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["auto_check_result"]
          variant_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          level_text_variant?: Json | null
          package_id?: string
          policy_override?: Json | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["auto_check_result"]
          variant_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_level_variants_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "feature_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_expert_registry_versions: {
        Row: {
          created_at: string
          expert_user_id: string
          expertise_areas: string[]
          id: string
          language_pairs: string[]
          protocol_version: string
          qualification_note: string
          registered_by: string
          registry_version: number
          status: string
        }
        Insert: {
          created_at?: string
          expert_user_id: string
          expertise_areas: string[]
          id?: string
          language_pairs: string[]
          protocol_version: string
          qualification_note: string
          registered_by: string
          registry_version: number
          status: string
        }
        Update: {
          created_at?: string
          expert_user_id?: string
          expertise_areas?: string[]
          id?: string
          language_pairs?: string[]
          protocol_version?: string
          qualification_note?: string
          registered_by?: string
          registry_version?: number
          status?: string
        }
        Relationships: []
      }
      pragma_final_corpus_generation_locks: {
        Row: {
          artifact_hash: string
          direction: string
          evidence_snapshot_hash: string
          id: string
          locked_at: string
          locked_by: string
          manifest_attestation_id: string
          pack_id: string
          pack_release_id: string
          pack_version: string
          prompt_snapshot_hash: string
          rationale_ko: string
          readiness_snapshot: Json
          readiness_snapshot_hash: string
          schema_version: string
          scope_speech_acts: string[]
          source_commit_ref: string
          target_minimum: number
        }
        Insert: {
          artifact_hash: string
          direction?: string
          evidence_snapshot_hash: string
          id?: string
          locked_at?: string
          locked_by: string
          manifest_attestation_id: string
          pack_id: string
          pack_release_id: string
          pack_version: string
          prompt_snapshot_hash: string
          rationale_ko: string
          readiness_snapshot: Json
          readiness_snapshot_hash: string
          schema_version?: string
          scope_speech_acts: string[]
          source_commit_ref: string
          target_minimum?: number
        }
        Update: {
          artifact_hash?: string
          direction?: string
          evidence_snapshot_hash?: string
          id?: string
          locked_at?: string
          locked_by?: string
          manifest_attestation_id?: string
          pack_id?: string
          pack_release_id?: string
          pack_version?: string
          prompt_snapshot_hash?: string
          rationale_ko?: string
          readiness_snapshot?: Json
          readiness_snapshot_hash?: string
          schema_version?: string
          scope_speech_acts?: string[]
          source_commit_ref?: string
          target_minimum?: number
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_generation_loc_manifest_attestation_id_fkey"
            columns: ["manifest_attestation_id"]
            isOneToOne: false
            referencedRelation: "pragma_pack_manifest_attestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_generation_locks_pack_release_id_fkey"
            columns: ["pack_release_id"]
            isOneToOne: true
            referencedRelation: "pragma_realization_pack_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_final_corpus_generation_run_events: {
        Row: {
          actor_id: string
          event_type: string
          id: string
          occurred_at: string
          rationale_ko: string
          result: Json
          run_id: string
        }
        Insert: {
          actor_id: string
          event_type: string
          id?: string
          occurred_at?: string
          rationale_ko: string
          result?: Json
          run_id: string
        }
        Update: {
          actor_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          rationale_ko?: string
          result?: Json
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_generation_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_final_corpus_generation_runs: {
        Row: {
          created_at: string
          created_by: string
          generation_lock_id: string
          id: string
          plan_snapshot: Json
          plan_snapshot_hash: string
          plan_version: string
          run_sequence: number
          schema_version: string
          target_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          generation_lock_id: string
          id?: string
          plan_snapshot: Json
          plan_snapshot_hash: string
          plan_version: string
          run_sequence: number
          schema_version?: string
          target_count: number
        }
        Update: {
          created_at?: string
          created_by?: string
          generation_lock_id?: string
          id?: string
          plan_snapshot?: Json
          plan_snapshot_hash?: string
          plan_version?: string
          run_sequence?: number
          schema_version?: string
          target_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_generation_runs_generation_lock_id_fkey"
            columns: ["generation_lock_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_generation_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_final_corpus_mission_batch_events: {
        Row: {
          actor_id: string
          batch_id: string
          event_type: string
          id: string
          occurred_at: string
          rationale_ko: string
        }
        Insert: {
          actor_id: string
          batch_id: string
          event_type: string
          id?: string
          occurred_at?: string
          rationale_ko: string
        }
        Update: {
          actor_id?: string
          batch_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          rationale_ko?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_mission_batch_events_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_mission_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_final_corpus_mission_batches: {
        Row: {
          created_at: string
          created_by: string
          generation_run_id: string
          id: string
          lease_minutes: number
          max_item_attempts: number
          schema_version: string
          target_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          generation_run_id: string
          id?: string
          lease_minutes?: number
          max_item_attempts?: number
          schema_version?: string
          target_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          generation_run_id?: string
          id?: string
          lease_minutes?: number
          max_item_attempts?: number
          schema_version?: string
          target_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_mission_batches_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: true
            referencedRelation: "pragma_final_corpus_generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_final_corpus_mission_item_claims: {
        Row: {
          attempt_no: number
          batch_id: string
          claimed_at: string
          claimed_by: string
          id: string
          lease_expires_at: string
          plan_ordinal: number
          scenario_id: string
        }
        Insert: {
          attempt_no: number
          batch_id: string
          claimed_at?: string
          claimed_by: string
          id?: string
          lease_expires_at: string
          plan_ordinal: number
          scenario_id: string
        }
        Update: {
          attempt_no?: number
          batch_id?: string
          claimed_at?: string
          claimed_by?: string
          id?: string
          lease_expires_at?: string
          plan_ordinal?: number
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_mission_item_claims_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_mission_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_mission_item_claims_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      pragma_final_corpus_mission_item_results: {
        Row: {
          actor_id: string
          claim_id: string
          error_message: string | null
          generation_attempt_count: number | null
          id: string
          lineage_version_id: string | null
          occurred_at: string
          quality_verdict: string | null
          result: string
          rule_result: string | null
        }
        Insert: {
          actor_id: string
          claim_id: string
          error_message?: string | null
          generation_attempt_count?: number | null
          id?: string
          lineage_version_id?: string | null
          occurred_at?: string
          quality_verdict?: string | null
          result: string
          rule_result?: string | null
        }
        Update: {
          actor_id?: string
          claim_id?: string
          error_message?: string | null
          generation_attempt_count?: number | null
          id?: string
          lineage_version_id?: string | null
          occurred_at?: string
          quality_verdict?: string | null
          result?: string
          rule_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_mission_item_result_lineage_version_id_fkey"
            columns: ["lineage_version_id"]
            isOneToOne: true
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_mission_item_results_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: true
            referencedRelation: "pragma_final_corpus_mission_item_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_final_corpus_release_items: {
        Row: {
          core_snapshot_hash: string
          generation_item_key: string
          gold_regression_run_id: string
          mission_content_hash: string
          mission_prompt_snapshot_hash: string
          ordinal: number
          release_id: string
          release_resolution_id: string
          released_lineage_version_id: string
          scenario_id: string
        }
        Insert: {
          core_snapshot_hash: string
          generation_item_key: string
          gold_regression_run_id: string
          mission_content_hash: string
          mission_prompt_snapshot_hash: string
          ordinal: number
          release_id: string
          release_resolution_id: string
          released_lineage_version_id: string
          scenario_id: string
        }
        Update: {
          core_snapshot_hash?: string
          generation_item_key?: string
          gold_regression_run_id?: string
          mission_content_hash?: string
          mission_prompt_snapshot_hash?: string
          ordinal?: number
          release_id?: string
          release_resolution_id?: string
          released_lineage_version_id?: string
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_release_it_released_lineage_version_id_fkey"
            columns: ["released_lineage_version_id"]
            isOneToOne: true
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_release_items_gold_regression_run_id_fkey"
            columns: ["gold_regression_run_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_regression_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_release_items_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_release_items_release_resolution_id_fkey"
            columns: ["release_resolution_id"]
            isOneToOne: true
            referencedRelation: "mission_review_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_release_items_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: true
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      pragma_final_corpus_releases: {
        Row: {
          generation_lock_id: string
          generation_run_id: string
          id: string
          item_count: number
          manifest_snapshot: Json
          manifest_snapshot_hash: string
          pack_release_id: string
          rationale_ko: string
          released_at: string
          released_by: string
          schema_version: string
        }
        Insert: {
          generation_lock_id: string
          generation_run_id: string
          id?: string
          item_count: number
          manifest_snapshot: Json
          manifest_snapshot_hash: string
          pack_release_id: string
          rationale_ko: string
          released_at?: string
          released_by: string
          schema_version?: string
        }
        Update: {
          generation_lock_id?: string
          generation_run_id?: string
          id?: string
          item_count?: number
          manifest_snapshot?: Json
          manifest_snapshot_hash?: string
          pack_release_id?: string
          rationale_ko?: string
          released_at?: string
          released_by?: string
          schema_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_final_corpus_releases_generation_lock_id_fkey"
            columns: ["generation_lock_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_generation_locks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_releases_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: true
            referencedRelation: "pragma_final_corpus_generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_final_corpus_releases_pack_release_id_fkey"
            columns: ["pack_release_id"]
            isOneToOne: false
            referencedRelation: "pragma_realization_pack_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_gold_calibration_resolutions: {
        Row: {
          case_id: string
          case_version: string
          id: string
          rationale_ko: string
          resolution_round: number
          resolution_status: string
          resolved_at: string
          resolved_by: string
          resolved_case_snapshot: Json | null
          source_review_id: string
        }
        Insert: {
          case_id: string
          case_version: string
          id?: string
          rationale_ko: string
          resolution_round: number
          resolution_status: string
          resolved_at?: string
          resolved_by: string
          resolved_case_snapshot?: Json | null
          source_review_id: string
        }
        Update: {
          case_id?: string
          case_version?: string
          id?: string
          rationale_ko?: string
          resolution_round?: number
          resolution_status?: string
          resolved_at?: string
          resolved_by?: string
          resolved_case_snapshot?: Json | null
          source_review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_gold_calibration_resolutions_source_review_id_fkey"
            columns: ["source_review_id"]
            isOneToOne: true
            referencedRelation: "pragma_gold_calibration_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_gold_calibration_reviews: {
        Row: {
          candidate_assessments: Json
          case_content_hash: string
          case_id: string
          case_snapshot: Json
          case_version: string
          context_assessment: Json
          id: string
          overall_verdict: string
          rationale_ko: string
          realization_pack_id: string
          realization_pack_version: string
          review_round: number
          reviewer_user_id: string
          schema_version: string
          submitted_at: string
        }
        Insert: {
          candidate_assessments: Json
          case_content_hash: string
          case_id: string
          case_snapshot: Json
          case_version: string
          context_assessment: Json
          id?: string
          overall_verdict: string
          rationale_ko: string
          realization_pack_id: string
          realization_pack_version: string
          review_round?: number
          reviewer_user_id: string
          schema_version: string
          submitted_at?: string
        }
        Update: {
          candidate_assessments?: Json
          case_content_hash?: string
          case_id?: string
          case_snapshot?: Json
          case_version?: string
          context_assessment?: Json
          id?: string
          overall_verdict?: string
          rationale_ko?: string
          realization_pack_id?: string
          realization_pack_version?: string
          review_round?: number
          reviewer_user_id?: string
          schema_version?: string
          submitted_at?: string
        }
        Relationships: []
      }
      pragma_gold_expert_resolution_signoffs: {
        Row: {
          decision: string
          id: string
          rationale_ko: string
          resolution_id: string
          reviewer_user_id: string
          signed_at: string
        }
        Insert: {
          decision: string
          id?: string
          rationale_ko: string
          resolution_id: string
          reviewer_user_id: string
          signed_at?: string
        }
        Update: {
          decision?: string
          id?: string
          rationale_ko?: string
          resolution_id?: string
          reviewer_user_id?: string
          signed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_gold_expert_resolution_signoffs_resolution_id_fkey"
            columns: ["resolution_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_expert_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_gold_expert_resolutions: {
        Row: {
          calibration_resolution_id: string
          final_status: string
          id: string
          protocol_version: string
          rationale_ko: string
          resolution_method: string
          resolution_revision: number
          resolved_at: string
          resolved_by: string
          resolved_candidate_assessments: Json | null
          resolved_case_snapshot: Json | null
          resolved_context_assessment: Json | null
          review_ids: string[]
          review_round: number
          schema_version: string
          supersedes_resolution_id: string | null
        }
        Insert: {
          calibration_resolution_id: string
          final_status: string
          id?: string
          protocol_version?: string
          rationale_ko: string
          resolution_method: string
          resolution_revision: number
          resolved_at?: string
          resolved_by: string
          resolved_candidate_assessments?: Json | null
          resolved_case_snapshot?: Json | null
          resolved_context_assessment?: Json | null
          review_ids: string[]
          review_round: number
          schema_version?: string
          supersedes_resolution_id?: string | null
        }
        Update: {
          calibration_resolution_id?: string
          final_status?: string
          id?: string
          protocol_version?: string
          rationale_ko?: string
          resolution_method?: string
          resolution_revision?: number
          resolved_at?: string
          resolved_by?: string
          resolved_candidate_assessments?: Json | null
          resolved_case_snapshot?: Json | null
          resolved_context_assessment?: Json | null
          review_ids?: string[]
          review_round?: number
          schema_version?: string
          supersedes_resolution_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pragma_gold_expert_resolutions_calibration_resolution_id_fkey"
            columns: ["calibration_resolution_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_calibration_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_gold_expert_resolutions_supersedes_resolution_id_fkey"
            columns: ["supersedes_resolution_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_expert_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_gold_expert_review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          blind_case_snapshot: Json
          blind_review: boolean
          calibration_resolution_id: string
          case_content_hash: string
          case_id: string
          case_version: string
          expert_registry_version_id: string
          id: string
          protocol_version: string
          review_round: number
          reviewer_user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          blind_case_snapshot: Json
          blind_review?: boolean
          calibration_resolution_id: string
          case_content_hash: string
          case_id: string
          case_version: string
          expert_registry_version_id: string
          id?: string
          protocol_version?: string
          review_round: number
          reviewer_user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          blind_case_snapshot?: Json
          blind_review?: boolean
          calibration_resolution_id?: string
          case_content_hash?: string
          case_id?: string
          case_version?: string
          expert_registry_version_id?: string
          id?: string
          protocol_version?: string
          review_round?: number
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_gold_expert_review_assig_expert_registry_version_id_fkey"
            columns: ["expert_registry_version_id"]
            isOneToOne: false
            referencedRelation: "pragma_expert_registry_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_gold_expert_review_assign_calibration_resolution_id_fkey"
            columns: ["calibration_resolution_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_calibration_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_gold_expert_reviews: {
        Row: {
          assignment_id: string
          calibration_resolution_id: string
          candidate_assessments: Json
          context_assessment: Json
          id: string
          independence_declaration: Json
          overall_verdict: string
          protocol_version: string
          rationale_ko: string
          review_round: number
          reviewer_user_id: string
          schema_version: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          calibration_resolution_id: string
          candidate_assessments: Json
          context_assessment: Json
          id?: string
          independence_declaration: Json
          overall_verdict: string
          protocol_version: string
          rationale_ko: string
          review_round: number
          reviewer_user_id: string
          schema_version: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          calibration_resolution_id?: string
          candidate_assessments?: Json
          context_assessment?: Json
          id?: string
          independence_declaration?: Json
          overall_verdict?: string
          protocol_version?: string
          rationale_ko?: string
          review_round?: number
          reviewer_user_id?: string
          schema_version?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_gold_expert_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "pragma_gold_expert_review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_gold_expert_reviews_calibration_resolution_id_fkey"
            columns: ["calibration_resolution_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_calibration_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_gold_regression_runs: {
        Row: {
          created_at: string
          created_by: string
          evaluator_version: string
          gate_status: string
          gold_case_snapshots: Json
          gold_resolution_ids: string[]
          id: string
          observations: Json
          prompt_snapshot_hash: string
          realization_pack_id: string
          realization_pack_version: string
          report: Json
          schema_version: string
        }
        Insert: {
          created_at?: string
          created_by: string
          evaluator_version: string
          gate_status: string
          gold_case_snapshots: Json
          gold_resolution_ids: string[]
          id?: string
          observations: Json
          prompt_snapshot_hash: string
          realization_pack_id: string
          realization_pack_version: string
          report: Json
          schema_version: string
        }
        Update: {
          created_at?: string
          created_by?: string
          evaluator_version?: string
          gate_status?: string
          gold_case_snapshots?: Json
          gold_resolution_ids?: string[]
          id?: string
          observations?: Json
          prompt_snapshot_hash?: string
          realization_pack_id?: string
          realization_pack_version?: string
          report?: Json
          schema_version?: string
        }
        Relationships: []
      }
      pragma_hsk_topic_mappings: {
        Row: {
          app_domain_code: string | null
          axis_code: string
          coded_at: string | null
          coded_by: string | null
          coding_status: string
          created_at: string
          exclusion_reason_code: string | null
          has_state_administration_frame: boolean
          mapping_version: string
          notes: string | null
          scope_code: string
          selection_status: string
          source_id: string
          topic_seq: number
          updated_at: string
        }
        Insert: {
          app_domain_code?: string | null
          axis_code: string
          coded_at?: string | null
          coded_by?: string | null
          coding_status: string
          created_at?: string
          exclusion_reason_code?: string | null
          has_state_administration_frame?: boolean
          mapping_version: string
          notes?: string | null
          scope_code: string
          selection_status?: string
          source_id: string
          topic_seq: number
          updated_at?: string
        }
        Update: {
          app_domain_code?: string | null
          axis_code?: string
          coded_at?: string | null
          coded_by?: string | null
          coding_status?: string
          created_at?: string
          exclusion_reason_code?: string | null
          has_state_administration_frame?: boolean
          mapping_version?: string
          notes?: string | null
          scope_code?: string
          selection_status?: string
          source_id?: string
          topic_seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_hsk_topic_mappings_source_id_topic_seq_fkey"
            columns: ["source_id", "topic_seq"]
            isOneToOne: false
            referencedRelation: "hsk3_topics"
            referencedColumns: ["source_id", "topic_seq"]
          },
        ]
      }
      pragma_improvement_candidate_sources: {
        Row: {
          added_at: string
          candidate_id: string
          id: string
          source_field: string
          source_id: string
          source_snapshot: Json
          source_type: string
        }
        Insert: {
          added_at?: string
          candidate_id: string
          id?: string
          source_field?: string
          source_id: string
          source_snapshot?: Json
          source_type: string
        }
        Update: {
          added_at?: string
          candidate_id?: string
          id?: string
          source_field?: string
          source_id?: string
          source_snapshot?: Json
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_improvement_candidate_sources_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "pragma_improvement_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_improvement_candidates: {
        Row: {
          analysis_contract_version: string
          candidate_key: string
          content_hash: string | null
          created_at: string
          created_by: string
          evidence_fingerprint: string
          id: string
          metrics: Json
          proposed_change: Json | null
          realization_pack_id: string | null
          realization_pack_version: string | null
          signal_type: string
          source_refs: Json
          source_window_end: string | null
          source_window_start: string | null
          suggested_action: string
          target_feature: string | null
        }
        Insert: {
          analysis_contract_version?: string
          candidate_key: string
          content_hash?: string | null
          created_at?: string
          created_by: string
          evidence_fingerprint: string
          id?: string
          metrics?: Json
          proposed_change?: Json | null
          realization_pack_id?: string | null
          realization_pack_version?: string | null
          signal_type: string
          source_refs?: Json
          source_window_end?: string | null
          source_window_start?: string | null
          suggested_action: string
          target_feature?: string | null
        }
        Update: {
          analysis_contract_version?: string
          candidate_key?: string
          content_hash?: string | null
          created_at?: string
          created_by?: string
          evidence_fingerprint?: string
          id?: string
          metrics?: Json
          proposed_change?: Json | null
          realization_pack_id?: string | null
          realization_pack_version?: string | null
          signal_type?: string
          source_refs?: Json
          source_window_end?: string | null
          source_window_start?: string | null
          suggested_action?: string
          target_feature?: string | null
        }
        Relationships: []
      }
      pragma_improvement_decisions: {
        Row: {
          candidate_evidence_fingerprint: string | null
          candidate_id: string
          decided_at: string
          decided_by: string
          decision: string
          decision_contract_version: string
          gold_regression_run_id: string | null
          id: string
          note_ko: string
          resulting_gold_case_ids: string[]
          resulting_gold_resolution_ids: string[]
          resulting_pack_id: string | null
          resulting_pack_release_id: string | null
          resulting_pack_version: string | null
        }
        Insert: {
          candidate_evidence_fingerprint?: string | null
          candidate_id: string
          decided_at?: string
          decided_by: string
          decision: string
          decision_contract_version?: string
          gold_regression_run_id?: string | null
          id?: string
          note_ko: string
          resulting_gold_case_ids?: string[]
          resulting_gold_resolution_ids?: string[]
          resulting_pack_id?: string | null
          resulting_pack_release_id?: string | null
          resulting_pack_version?: string | null
        }
        Update: {
          candidate_evidence_fingerprint?: string | null
          candidate_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          decision_contract_version?: string
          gold_regression_run_id?: string | null
          id?: string
          note_ko?: string
          resulting_gold_case_ids?: string[]
          resulting_gold_resolution_ids?: string[]
          resulting_pack_id?: string | null
          resulting_pack_release_id?: string | null
          resulting_pack_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pragma_improvement_decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "pragma_improvement_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_improvement_decisions_gold_regression_run_id_fkey"
            columns: ["gold_regression_run_id"]
            isOneToOne: false
            referencedRelation: "pragma_gold_regression_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_improvement_decisions_resulting_pack_release_id_fkey"
            columns: ["resulting_pack_release_id"]
            isOneToOne: false
            referencedRelation: "pragma_realization_pack_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_improvement_refresh_runs: {
        Row: {
          contract_version: string
          created_at: string
          created_by: string
          created_candidate_ids: string[]
          created_counts: Json
          id: string
          thresholds: Json
          window_end: string
          window_start: string
        }
        Insert: {
          contract_version: string
          created_at?: string
          created_by: string
          created_candidate_ids?: string[]
          created_counts: Json
          id?: string
          thresholds: Json
          window_end: string
          window_start: string
        }
        Update: {
          contract_version?: string
          created_at?: string
          created_by?: string
          created_candidate_ids?: string[]
          created_counts?: Json
          id?: string
          thresholds?: Json
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      pragma_operational_verifications: {
        Row: {
          contract_version: string
          id: string
          result: Json
          result_hash: string
          run_ref: string
          schema_version: string
          source_commit_ref: string
          status: string
          verification_type: string
          verified_at: string
        }
        Insert: {
          contract_version: string
          id?: string
          result: Json
          result_hash: string
          run_ref: string
          schema_version?: string
          source_commit_ref: string
          status: string
          verification_type: string
          verified_at?: string
        }
        Update: {
          contract_version?: string
          id?: string
          result?: Json
          result_hash?: string
          run_ref?: string
          schema_version?: string
          source_commit_ref?: string
          status?: string
          verification_type?: string
          verified_at?: string
        }
        Relationships: []
      }
      pragma_pack_manifest_attestations: {
        Row: {
          artifact_hash: string
          attestation_method: string
          attested_at: string
          build_run_ref: string
          canonicalization_version: string
          evidence_snapshot_hash: string
          expansion_authorization_id: string | null
          id: string
          pack_id: string
          pack_version: string
          prompt_snapshot_hash: string
          schema_version: string
          scope_speech_acts: string[]
          source_commit_ref: string
        }
        Insert: {
          artifact_hash: string
          attestation_method?: string
          attested_at?: string
          build_run_ref: string
          canonicalization_version: string
          evidence_snapshot_hash: string
          expansion_authorization_id?: string | null
          id?: string
          pack_id: string
          pack_version: string
          prompt_snapshot_hash: string
          schema_version?: string
          scope_speech_acts?: string[]
          source_commit_ref: string
        }
        Update: {
          artifact_hash?: string
          attestation_method?: string
          attested_at?: string
          build_run_ref?: string
          canonicalization_version?: string
          evidence_snapshot_hash?: string
          expansion_authorization_id?: string | null
          id?: string
          pack_id?: string
          pack_version?: string
          prompt_snapshot_hash?: string
          schema_version?: string
          scope_speech_acts?: string[]
          source_commit_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "pragma_pack_manifest_attestatio_expansion_authorization_id_fkey"
            columns: ["expansion_authorization_id"]
            isOneToOne: false
            referencedRelation: "pragma_speech_act_expansion_authorizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_realization_pack_releases: {
        Row: {
          artifact_hash: string
          created_at: string
          created_by: string
          evidence_snapshot_hash: string
          id: string
          manifest_attestation_id: string | null
          pack_id: string
          pack_version: string
          prompt_snapshot_hash: string
          release_note_ko: string
          source_candidate_id: string | null
          source_commit_ref: string
          supersedes_release_id: string | null
        }
        Insert: {
          artifact_hash: string
          created_at?: string
          created_by: string
          evidence_snapshot_hash: string
          id?: string
          manifest_attestation_id?: string | null
          pack_id: string
          pack_version: string
          prompt_snapshot_hash: string
          release_note_ko: string
          source_candidate_id?: string | null
          source_commit_ref: string
          supersedes_release_id?: string | null
        }
        Update: {
          artifact_hash?: string
          created_at?: string
          created_by?: string
          evidence_snapshot_hash?: string
          id?: string
          manifest_attestation_id?: string | null
          pack_id?: string
          pack_version?: string
          prompt_snapshot_hash?: string
          release_note_ko?: string
          source_candidate_id?: string | null
          source_commit_ref?: string
          supersedes_release_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pragma_realization_pack_releases_manifest_attestation_id_fkey"
            columns: ["manifest_attestation_id"]
            isOneToOne: false
            referencedRelation: "pragma_pack_manifest_attestations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_realization_pack_releases_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "pragma_improvement_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pragma_realization_pack_releases_supersedes_release_id_fkey"
            columns: ["supersedes_release_id"]
            isOneToOne: true
            referencedRelation: "pragma_realization_pack_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      pragma_speech_act_expansion_authorizations: {
        Row: {
          authorized_at: string
          authorized_by: string
          basis_pack_id: string
          basis_pack_release_id: string
          basis_pack_version: string
          id: string
          rationale_ko: string
          readiness_snapshot: Json
          readiness_snapshot_hash: string
          schema_version: string
          target_pack_id: string
          target_scope_speech_acts: string[]
        }
        Insert: {
          authorized_at?: string
          authorized_by: string
          basis_pack_id: string
          basis_pack_release_id: string
          basis_pack_version: string
          id?: string
          rationale_ko: string
          readiness_snapshot: Json
          readiness_snapshot_hash: string
          schema_version?: string
          target_pack_id: string
          target_scope_speech_acts: string[]
        }
        Update: {
          authorized_at?: string
          authorized_by?: string
          basis_pack_id?: string
          basis_pack_release_id?: string
          basis_pack_version?: string
          id?: string
          rationale_ko?: string
          readiness_snapshot?: Json
          readiness_snapshot_hash?: string
          schema_version?: string
          target_pack_id?: string
          target_scope_speech_acts?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "pragma_speech_act_expansion_authoriz_basis_pack_release_id_fkey"
            columns: ["basis_pack_release_id"]
            isOneToOne: false
            referencedRelation: "pragma_realization_pack_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_year_or_program: string | null
          affiliation: string | null
          affiliation_or_status: string | null
          ai_prompting_style_for_ti: string | null
          anonymization_notice_confirmed: boolean
          anonymous_participant_id: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience: string | null
          chinese_exposure_contexts: string[] | null
          chinese_level: string | null
          chinese_proficiency_self_report: string | null
          consent_anonymous_analysis: boolean
          consent_data_use: boolean
          consent_email_report: boolean
          created_at: string
          email: string | null
          full_name: string | null
          genai_use_frequency: string | null
          grade_or_program: string | null
          id: string
          interpreting_experience: string | null
          language_background: string | null
          name: string | null
          perceived_ai_ti_difficulty: string | null
          perceived_business_chinese_ti_risk: string | null
          profile_completed: boolean
          report_email_consent: boolean | null
          research_consent_version: string | null
          research_use_consent: boolean
          role: Database["public"]["Enums"]["app_role"]
          ti_experience_level: string | null
          ti_experience_modes: string[] | null
          ti_experience_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year_or_program?: string | null
          affiliation?: string | null
          affiliation_or_status?: string | null
          ai_prompting_style_for_ti?: string | null
          anonymization_notice_confirmed?: boolean
          anonymous_participant_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience?: string | null
          chinese_exposure_contexts?: string[] | null
          chinese_level?: string | null
          chinese_proficiency_self_report?: string | null
          consent_anonymous_analysis?: boolean
          consent_data_use?: boolean
          consent_email_report?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          genai_use_frequency?: string | null
          grade_or_program?: string | null
          id?: string
          interpreting_experience?: string | null
          language_background?: string | null
          name?: string | null
          perceived_ai_ti_difficulty?: string | null
          perceived_business_chinese_ti_risk?: string | null
          profile_completed?: boolean
          report_email_consent?: boolean | null
          research_consent_version?: string | null
          research_use_consent?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          ti_experience_level?: string | null
          ti_experience_modes?: string[] | null
          ti_experience_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year_or_program?: string | null
          affiliation?: string | null
          affiliation_or_status?: string | null
          ai_prompting_style_for_ti?: string | null
          anonymization_notice_confirmed?: boolean
          anonymous_participant_id?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          business_chinese_experience?: string | null
          chinese_exposure_contexts?: string[] | null
          chinese_level?: string | null
          chinese_proficiency_self_report?: string | null
          consent_anonymous_analysis?: boolean
          consent_data_use?: boolean
          consent_email_report?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          genai_use_frequency?: string | null
          grade_or_program?: string | null
          id?: string
          interpreting_experience?: string | null
          language_background?: string | null
          name?: string | null
          perceived_ai_ti_difficulty?: string | null
          perceived_business_chinese_ti_risk?: string | null
          profile_completed?: boolean
          report_email_consent?: boolean | null
          research_consent_version?: string | null
          research_use_consent?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          ti_experience_level?: string | null
          ti_experience_modes?: string[] | null
          ti_experience_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          prompt_key: string
          title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          prompt_key: string
          title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          prompt_key?: string
          title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      research_data_exports: {
        Row: {
          created_at: string
          dataset_type: string
          export_schema_version: string
          filter_spec: Json
          id: string
          requested_by: string
          row_count: number
        }
        Insert: {
          created_at?: string
          dataset_type: string
          export_schema_version: string
          filter_spec?: Json
          id?: string
          requested_by: string
          row_count: number
        }
        Update: {
          created_at?: string
          dataset_type?: string
          export_schema_version?: string
          filter_spec?: Json
          id?: string
          requested_by?: string
          row_count?: number
        }
        Relationships: []
      }
      scenario_candidates: {
        Row: {
          appropriateness_label: string | null
          candidate_text: string | null
          created_at: string
          directness_level: number | null
          display_order: number | null
          failed_challenge: string[] | null
          id: string
          rationale: string | null
          scenario_id: string
        }
        Insert: {
          appropriateness_label?: string | null
          candidate_text?: string | null
          created_at?: string
          directness_level?: number | null
          display_order?: number | null
          failed_challenge?: string[] | null
          id?: string
          rationale?: string | null
          scenario_id: string
        }
        Update: {
          appropriateness_label?: string | null
          candidate_text?: string | null
          created_at?: string
          directness_level?: number | null
          display_order?: number | null
          failed_challenge?: string[] | null
          id?: string
          rationale?: string | null
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_candidates_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
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
          approval_basis: string | null
          auto_check_result:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function: string | null
          challenge_intensity: string | null
          content_format: string
          content_hash: string | null
          core_content: Json | null
          core_snapshot_hash: string | null
          created_at: string | null
          dataset_class: string
          domain: string | null
          final_corpus_generation_run_id: string | null
          final_corpus_release_id: string | null
          generation_item_key: string | null
          generation_prompt_version: string | null
          generation_provider: string | null
          generation_run_id: string | null
          generator_model: string | null
          genre: string | null
          hsk_level_min: number | null
          industry_sector: string | null
          interaction_context: string | null
          language_direction: string | null
          learner_level: string | null
          mission_content: Json | null
          mission_reviewed_at: string | null
          mission_reviewed_by: string | null
          mission_status: string | null
          mode: string | null
          pragmatic_challenge: string[] | null
          prompt_snapshot_hash: string | null
          release_gate_mode: string
          released_lineage_version_id: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          scenario_d: string | null
          scenario_id: string
          scenario_p: string | null
          scenario_r: string | null
          source_modality: string | null
          source_text: string | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          speech_act_text: string | null
          supersedes_scenario_id: string | null
          target_feature: string | null
          target_feature_version: string | null
          theme_code: string | null
          title: string
          topic: string | null
          topic_code: string | null
          updated_at: string | null
          usage_assignment: Database["public"]["Enums"]["usage_assignment"]
          week_no: number | null
        }
        Insert: {
          approval_basis?: string | null
          auto_check_result?:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function?: string | null
          challenge_intensity?: string | null
          content_format?: string
          content_hash?: string | null
          core_content?: Json | null
          core_snapshot_hash?: string | null
          created_at?: string | null
          dataset_class?: string
          domain?: string | null
          final_corpus_generation_run_id?: string | null
          final_corpus_release_id?: string | null
          generation_item_key?: string | null
          generation_prompt_version?: string | null
          generation_provider?: string | null
          generation_run_id?: string | null
          generator_model?: string | null
          genre?: string | null
          hsk_level_min?: number | null
          industry_sector?: string | null
          interaction_context?: string | null
          language_direction?: string | null
          learner_level?: string | null
          mission_content?: Json | null
          mission_reviewed_at?: string | null
          mission_reviewed_by?: string | null
          mission_status?: string | null
          mode?: string | null
          pragmatic_challenge?: string[] | null
          prompt_snapshot_hash?: string | null
          release_gate_mode?: string
          released_lineage_version_id?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          scenario_d?: string | null
          scenario_id?: string
          scenario_p?: string | null
          scenario_r?: string | null
          source_modality?: string | null
          source_text?: string | null
          speech_act: Database["public"]["Enums"]["speech_act"]
          speech_act_text?: string | null
          supersedes_scenario_id?: string | null
          target_feature?: string | null
          target_feature_version?: string | null
          theme_code?: string | null
          title: string
          topic?: string | null
          topic_code?: string | null
          updated_at?: string | null
          usage_assignment?: Database["public"]["Enums"]["usage_assignment"]
          week_no?: number | null
        }
        Update: {
          approval_basis?: string | null
          auto_check_result?:
            | Database["public"]["Enums"]["auto_check_result"]
            | null
          business_function?: string | null
          challenge_intensity?: string | null
          content_format?: string
          content_hash?: string | null
          core_content?: Json | null
          core_snapshot_hash?: string | null
          created_at?: string | null
          dataset_class?: string
          domain?: string | null
          final_corpus_generation_run_id?: string | null
          final_corpus_release_id?: string | null
          generation_item_key?: string | null
          generation_prompt_version?: string | null
          generation_provider?: string | null
          generation_run_id?: string | null
          generator_model?: string | null
          genre?: string | null
          hsk_level_min?: number | null
          industry_sector?: string | null
          interaction_context?: string | null
          language_direction?: string | null
          learner_level?: string | null
          mission_content?: Json | null
          mission_reviewed_at?: string | null
          mission_reviewed_by?: string | null
          mission_status?: string | null
          mode?: string | null
          pragmatic_challenge?: string[] | null
          prompt_snapshot_hash?: string | null
          release_gate_mode?: string
          released_lineage_version_id?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          scenario_d?: string | null
          scenario_id?: string
          scenario_p?: string | null
          scenario_r?: string | null
          source_modality?: string | null
          source_text?: string | null
          speech_act?: Database["public"]["Enums"]["speech_act"]
          speech_act_text?: string | null
          supersedes_scenario_id?: string | null
          target_feature?: string | null
          target_feature_version?: string | null
          theme_code?: string | null
          title?: string
          topic?: string | null
          topic_code?: string | null
          updated_at?: string | null
          usage_assignment?: Database["public"]["Enums"]["usage_assignment"]
          week_no?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_final_corpus_generation_run_id_fkey"
            columns: ["final_corpus_generation_run_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_final_corpus_release_id_fkey"
            columns: ["final_corpus_release_id"]
            isOneToOne: false
            referencedRelation: "pragma_final_corpus_releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_released_lineage_version_id_fkey"
            columns: ["released_lineage_version_id"]
            isOneToOne: false
            referencedRelation: "mission_lineage_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenarios_supersedes_scenario_id_fkey"
            columns: ["supersedes_scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["scenario_id"]
          },
        ]
      }
      youtube_sources: {
        Row: {
          available_langs: string[] | null
          created_at: string
          created_by: string | null
          extract_status: string | null
          id: string
          lang: string | null
          transcript: string | null
          url: string
          video_title: string | null
        }
        Insert: {
          available_langs?: string[] | null
          created_at?: string
          created_by?: string | null
          extract_status?: string | null
          id?: string
          lang?: string | null
          transcript?: string | null
          url: string
          video_title?: string | null
        }
        Update: {
          available_langs?: string[] | null
          created_at?: string
          created_by?: string | null
          extract_status?: string | null
          id?: string
          lang?: string | null
          transcript?: string | null
          url?: string
          video_title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      hsk3_reference_status: {
        Row: {
          derived_topic_rows: number | null
          effective_at: string | null
          extraction_version: string | null
          manifest_version: string | null
          official_topic_rows: number | null
          official_url: string | null
          publisher: string | null
          released_at: string | null
          researcher_mapping_rows: number | null
          sha256: string | null
          source_id: string | null
          title: string | null
          vocabulary_entries: number | null
        }
        Insert: {
          derived_topic_rows?: never
          effective_at?: string | null
          extraction_version?: string | null
          manifest_version?: string | null
          official_topic_rows?: never
          official_url?: string | null
          publisher?: string | null
          released_at?: string | null
          researcher_mapping_rows?: never
          sha256?: string | null
          source_id?: string | null
          title?: string | null
          vocabulary_entries?: never
        }
        Update: {
          derived_topic_rows?: never
          effective_at?: string | null
          extraction_version?: string | null
          manifest_version?: string | null
          official_topic_rows?: never
          official_url?: string | null
          publisher?: string | null
          released_at?: string | null
          researcher_mapping_rows?: never
          sha256?: string | null
          source_id?: string | null
          title?: string | null
          vocabulary_entries?: never
        }
        Relationships: []
      }
      hsk3_vocab_cumulative: {
        Row: {
          extra_levels: number[] | null
          headword: string | null
          intro_band: string | null
          intro_level: number | null
          is_multi_sense: boolean | null
          is_phrase: boolean | null
          is_polyphone: boolean | null
          pinyin: string | null
          pinyin_norm: string | null
          pos: string | null
          reference_ceiling: number | null
          sense_no: number | null
          seq: number | null
          source_form: string | null
          source_id: string | null
          source_note: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hsk3_vocab_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hsk_reference_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hsk3_vocab_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "hsk3_reference_status"
            referencedColumns: ["source_id"]
          },
        ]
      }
    }
    Functions: {
      abort_pragma_final_corpus_generation_run: {
        Args: { p_rationale_ko: string; p_run_id: string }
        Returns: string
      }
      append_learner_mission_event: {
        Args: { p_payload: Json }
        Returns: string
      }
      apply_pragma_improvement_candidate: {
        Args: {
          p_candidate_id: string
          p_gold_regression_run_id: string
          p_note_ko: string
          p_pack_release_id: string
          p_resulting_gold_case_ids: string[]
        }
        Returns: string
      }
      assign_gold_expert_review: {
        Args: {
          p_calibration_resolution_id: string
          p_review_round: number
          p_reviewer_user_id: string
        }
        Returns: string
      }
      assign_mission_expert_review: {
        Args: {
          p_lineage_version_id: string
          p_review_round: number
          p_reviewer_user_id: string
        }
        Returns: string
      }
      authorize_pragma_speech_act_expansion: {
        Args: {
          p_basis_pack_id: string
          p_rationale_ko: string
          p_target_pack_id: string
          p_target_scope_speech_acts: string[]
        }
        Returns: string
      }
      claim_pragma_final_corpus_mission_item: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      close_pragma_final_corpus_generation_run: {
        Args: { p_rationale_ko: string; p_run_id: string }
        Returns: string
      }
      complete_pragma_final_corpus_mission_batch: {
        Args: { p_batch_id: string; p_rationale_ko: string }
        Returns: string
      }
      create_pragma_final_corpus_generation_run: {
        Args: { p_generation_lock_id: string; p_plan_snapshot: Json }
        Returns: string
      }
      ensure_test_dev_profile: { Args: never; Returns: undefined }
      export_learner_mission_events: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      get_pragma_final_corpus_generation_readiness: {
        Args: { p_pack_id: string }
        Returns: Json
      }
      get_pragma_final_corpus_mission_batch_state: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      get_pragma_final_corpus_release_readiness: {
        Args: { p_run_id: string }
        Returns: Json
      }
      get_pragma_final_corpus_run_state: {
        Args: { p_run_id: string }
        Returns: Json
      }
      get_pragma_moat_expansion_readiness: {
        Args: { p_pack_id?: string }
        Returns: Json
      }
      has_completed_learner_profile: { Args: never; Returns: boolean }
      hsk3_match_tokens: {
        Args: {
          p_max_intro_level: number
          p_source_id: string
          p_tokens: string[]
        }
        Returns: {
          headword: string
          intro_level: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      lock_pragma_final_corpus_generation: {
        Args: { p_pack_id: string; p_rationale_ko: string }
        Returns: string
      }
      make_gold_expert_blind_snapshot: { Args: { p_case: Json }; Returns: Json }
      materialize_pragma_improvement_candidates: {
        Args: {
          p_min_distinct_attempts?: number
          p_min_distinct_participants?: number
          p_window_end?: string
          p_window_start?: string
        }
        Returns: string
      }
      pause_pragma_final_corpus_mission_batch: {
        Args: { p_batch_id: string; p_rationale_ko: string }
        Returns: string
      }
      pragma_semver_is_greater: {
        Args: { p_new: string; p_old: string }
        Returns: boolean
      }
      prepare_pragma_final_corpus_mission_batch: {
        Args: { p_generation_run_id: string; p_rationale_ko: string }
        Returns: string
      }
      propose_gold_expert_resolution: {
        Args: { p_payload: Json }
        Returns: string
      }
      propose_mission_review_resolution: {
        Args: { p_payload: Json }
        Returns: string
      }
      reconcile_pragma_final_corpus_mission_batch: {
        Args: { p_batch_id: string }
        Returns: number
      }
      record_gold_regression_run: {
        Args: {
          p_evaluator_version: string
          p_gold_resolution_ids: string[]
          p_observations: Json
          p_prompt_snapshot_hash: string
        }
        Returns: string
      }
      record_pragma_final_corpus_mission_item_result: {
        Args: {
          p_claim_id: string
          p_error_message?: string
          p_generation_attempt_count?: number
          p_quality_verdict?: string
          p_result: string
          p_rule_result?: string
        }
        Returns: string
      }
      record_pragma_improvement_decision: {
        Args: { p_candidate_id: string; p_decision: string; p_note_ko: string }
        Returns: string
      }
      record_pragma_realization_pack_release: {
        Args: {
          p_artifact_hash: string
          p_evidence_snapshot_hash: string
          p_manifest_attestation_id: string
          p_pack_id: string
          p_pack_version: string
          p_prompt_snapshot_hash: string
          p_release_note_ko: string
          p_source_candidate_id?: string
          p_source_commit_ref: string
        }
        Returns: string
      }
      register_pragma_expert: {
        Args: {
          p_expert_user_id: string
          p_expertise_areas: string[]
          p_language_pairs: string[]
          p_qualification_note: string
          p_status: string
        }
        Returns: string
      }
      release_mission: {
        Args: {
          p_gold_regression_run_id: string
          p_resolution_id: string
          p_reviewed_lineage_id: string
          p_scenario_id: string
        }
        Returns: string
      }
      release_pragma_final_corpus: {
        Args: { p_rationale_ko: string; p_run_id: string }
        Returns: string
      }
      review_mission: { Args: { p_scenario_id: string }; Returns: string }
      save_final_corpus_core: {
        Args: { p_payload: Json; p_run_id: string }
        Returns: string
      }
      save_generated_core: { Args: { p_payload: Json }; Returns: string }
      save_generated_mission: {
        Args: { p_payload: Json; p_scenario_id: string }
        Returns: string
      }
      save_generated_scenario: { Args: { p_payload: Json }; Returns: string }
      start_pragma_final_corpus_generation_run: {
        Args: { p_rationale_ko: string; p_run_id: string }
        Returns: string
      }
      validate_pragma_final_corpus_plan: {
        Args: { p_plan: Json }
        Returns: undefined
      }
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
      speech_act:
        | "request"
        | "refusal"
        | "apology"
        | "thanks"
        | "proposal"
        | "agreement"
        | "opposition"
        | "compliment"
        | "complaint"
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
  graphql_public: {
    Enums: {},
  },
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
      speech_act: [
        "request",
        "refusal",
        "apology",
        "thanks",
        "proposal",
        "agreement",
        "opposition",
        "compliment",
        "complaint",
      ],
      usage_assignment: [
        "archived_only",
        "coursework_published",
        "experiment_locked",
        "excluded",
      ],
    },
  },
} as const
