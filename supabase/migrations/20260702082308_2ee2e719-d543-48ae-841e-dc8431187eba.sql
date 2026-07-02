-- Restore Data API grants lost during remix. RLS policies (unchanged) still gate row access.

-- profiles: own read/insert/update + admin via RLS
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- decision_traces: own insert/select, admin select via RLS (no update/delete by design)
GRANT SELECT, INSERT ON public.decision_traces TO authenticated;
GRANT ALL ON public.decision_traces TO service_role;

-- scenarios: authenticated read, admin CRUD via RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT ALL ON public.scenarios TO service_role;

-- scenario_feedback: admin read via RLS
GRANT SELECT ON public.scenario_feedback TO authenticated;
GRANT ALL ON public.scenario_feedback TO service_role;

-- archive_items: authenticated read, EXCLUDING researcher_notes (kept private per prior security fix)
GRANT SELECT (id, title, title_auto_generated, mode, topic, item_type, difficulty, speech_act, discourse_genre, sector, source_text, source_origin, audio_url, youtube_url, youtube_id, is_learning_pick, status, created_at, updated_at) ON public.archive_items TO authenticated;
GRANT ALL ON public.archive_items TO service_role;