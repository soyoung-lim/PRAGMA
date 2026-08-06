-- PRAGMA canonical 495 interpreting-role audit (READ ONLY)
-- Canonical run: core_ko_zh_1785458303114
--
-- Supabase SQL Editor에서 절별로 선택해 실행한다. 모든 절은 SELECT/CTE뿐이며
-- DB 행을 바꾸지 않는다.
--
-- 해석 규율
-- 1) 정본 495의 계획값은 번역 378건 + 통역 117건이다.
-- 2) 아래 정규식은 사람 검토 순서를 정하는 선별기다. 탐지 건수를 역할 혼동
--    발생률로 쓰면 안 된다.
-- 3) 발생률의 분자는 사람이 `role_overlap`으로 확정한 건수, 분모는 사람이 실제로
--    검토한 건수다. 전수 검토하지 않았다면 표본 추출법과 reviewed 분모를 함께 쓴다.
-- 4) 블라인드 검토표(절 C)를 먼저 내보내고, 진단 힌트(절 D·E)는 판정 뒤 확인한다.

-- A. 정본 run 무결성 요약 ----------------------------------------------------
WITH settings AS (
  SELECT
    'core_ko_zh_1785458303114'::text AS run_id,
    495::integer AS expected_total,
    378::integer AS expected_translation,
    117::integer AS expected_interpreting
),
canonical AS (
  SELECT s.*
  FROM public.scenarios s
  CROSS JOIN settings cfg
  WHERE s.generation_run_id = cfg.run_id
)
SELECT
  cfg.run_id,
  count(c.scenario_id) AS actual_total,
  cfg.expected_total,
  count(c.scenario_id) = cfg.expected_total AS total_matches_plan,
  count(*) FILTER (WHERE c.mode = 'translation') AS translation_rows,
  cfg.expected_translation,
  count(*) FILTER (WHERE c.mode = 'stt_interpreting') AS interpreting_rows,
  cfg.expected_interpreting,
  count(*) FILTER (
    WHERE (c.mode = 'translation' AND c.source_modality IS DISTINCT FROM 'written')
       OR (c.mode = 'stt_interpreting' AND c.source_modality IS DISTINCT FROM 'spoken')
  ) AS mode_modality_mismatches,
  count(*) FILTER (
    WHERE COALESCE(c.language_direction, 'ko_zh') <> 'ko_zh'
  ) AS non_ko_zh_rows,
  count(DISTINCT c.generation_item_key) AS distinct_item_keys,
  count(DISTINCT c.prompt_snapshot_hash) AS prompt_hash_count,
  string_agg(DISTINCT COALESCE(c.prompt_snapshot_hash, '(missing)'), ', ')
    AS prompt_hashes,
  string_agg(DISTINCT COALESCE(c.core_content->>'schema_version', '(missing)'), ', ')
    AS core_schema_versions
FROM settings cfg
LEFT JOIN canonical c ON TRUE
GROUP BY cfg.run_id, cfg.expected_total, cfg.expected_translation,
  cfg.expected_interpreting;

-- B. 화행×수준별 번역·통역 쿼터 대조 ----------------------------------------
WITH settings AS (
  SELECT 'core_ko_zh_1785458303114'::text AS run_id
),
coverage AS (
  SELECT
    s.speech_act,
    s.learner_level,
    count(*) FILTER (WHERE s.mode = 'translation') AS translation_rows,
    count(*) FILTER (WHERE s.mode = 'stt_interpreting') AS interpreting_rows
  FROM public.scenarios s
  CROSS JOIN settings cfg
  WHERE s.generation_run_id = cfg.run_id
  GROUP BY s.speech_act, s.learner_level
)
SELECT
  speech_act,
  learner_level,
  translation_rows,
  CASE learner_level
    WHEN 'beginner_intermediate' THEN 13
    WHEN 'intermediate' THEN 15
    WHEN 'advanced' THEN 14
  END AS expected_translation,
  interpreting_rows,
  CASE learner_level
    WHEN 'beginner_intermediate' THEN 4
    WHEN 'intermediate' THEN 5
    WHEN 'advanced' THEN 4
  END AS expected_interpreting,
  translation_rows = CASE learner_level
    WHEN 'beginner_intermediate' THEN 13
    WHEN 'intermediate' THEN 15
    WHEN 'advanced' THEN 14
  END
  AND interpreting_rows = CASE learner_level
    WHEN 'beginner_intermediate' THEN 4
    WHEN 'intermediate' THEN 5
    WHEN 'advanced' THEN 4
  END AS cell_matches_plan
FROM coverage
ORDER BY speech_act, learner_level;

-- C. 사람 판정용 블라인드 전수표 ---------------------------------------------
-- 이 결과를 먼저 CSV로 내보낸다. 판정값은 내보낸 파일에서 사람이 입력한다.
-- 권장 verdict: distinct_roles | role_overlap | unclear
WITH settings AS (
  SELECT 'core_ko_zh_1785458303114'::text AS run_id
),
review_population AS (
  SELECT
    substring(md5(s.scenario_id::text || cfg.run_id), 1, 12) AS blind_id,
    COALESCE(s.core_content->>'situation_ko', s.topic, '') AS situation_ko,
    COALESCE(
      s.core_content->>'source_text',
      s.core_content->>'source_text_ko',
      s.source_text,
      ''
    ) AS source_text
  FROM public.scenarios s
  CROSS JOIN settings cfg
  WHERE s.generation_run_id = cfg.run_id
    AND s.mode = 'stt_interpreting'
)
SELECT
  row_number() OVER (ORDER BY blind_id) AS review_no,
  blind_id,
  situation_ko,
  source_text,
  NULL::text AS reviewer_verdict,
  NULL::text AS reviewer_note
FROM review_population
ORDER BY blind_id;

-- D. 정규식 선별 요약: 사람 판정 뒤에 확인 ------------------------------------
WITH settings AS (
  SELECT 'core_ko_zh_1785458303114'::text AS run_id
),
population AS (
  SELECT
    s.*,
    regexp_replace(
      COALESCE(s.core_content->>'situation_ko', s.topic, ''),
      '\s+', ' ', 'g'
    ) AS situation_norm
  FROM public.scenarios s
  CROSS JOIN settings cfg
  WHERE s.generation_run_id = cfg.run_id
    AND s.mode = 'stt_interpreting'
),
flags AS (
  SELECT
    p.*,
    situation_norm ~ '(학습자|학생)(는|은|가)?[^.!?。！？]{0,40}(한국어|중국어)[ ]*(원)?화자(로서|이다|이며|역할)'
      OR situation_norm ~ '(한국어|중국어)[ ]*(원)?화자[^.!?。！？]{0,40}(학습자|학생)(이다|이며|로서|역할)'
      AS learner_as_source_candidate,
    situation_norm ~ '(학습자|학생)(는|은|가)?[^.!?。！？]{0,40}(중국어[ ]*청자|중국인[ ]*청자|수신자)(로서|이다|이며|역할)'
      AS learner_as_target_candidate,
    situation_norm ~ '(학습자|학생)(는|은|가)?[^.!?。！？]{0,50}(직접|스스로)[^.!?。！？]{0,25}(요청|거절|사과|감사|제안|초대|반대|찬성|칭찬|불만)'
      AS learner_direct_act_candidate,
    situation_norm !~ '(통역|학습자|학생)' AS missing_interpreter_marker,
    situation_norm !~ '(한국어|한국인|한국 측|원발화자|발화자|화자[ ]*A|A는)' AS missing_source_marker,
    situation_norm !~ '(중국어|중국인|중국 측|목표언어|청자|수신자|화자[ ]*B|B는)' AS missing_target_marker
  FROM population p
),
classified AS (
  SELECT
    f.*,
    CASE
      WHEN learner_as_source_candidate
        OR learner_as_target_candidate
        OR learner_direct_act_candidate THEN 'P1_explicit_overlap_candidate'
      WHEN missing_interpreter_marker
        OR missing_source_marker
        OR missing_target_marker THEN 'P2_missing_role_marker'
      ELSE 'P3_no_regex_flag'
    END AS screening_priority
  FROM flags f
)
SELECT
  screening_priority,
  count(*) AS screening_rows,
  count(*) FILTER (WHERE learner_as_source_candidate) AS learner_as_source_candidates,
  count(*) FILTER (WHERE learner_as_target_candidate) AS learner_as_target_candidates,
  count(*) FILTER (WHERE learner_direct_act_candidate) AS learner_direct_act_candidates,
  count(*) FILTER (WHERE missing_interpreter_marker) AS missing_interpreter_markers,
  count(*) FILTER (WHERE missing_source_marker) AS missing_source_markers,
  count(*) FILTER (WHERE missing_target_marker) AS missing_target_markers
FROM classified
GROUP BY screening_priority
ORDER BY screening_priority;

-- E. 진단 상세표: 선별 근거와 실제 ID를 연결 -----------------------------------
WITH settings AS (
  SELECT 'core_ko_zh_1785458303114'::text AS run_id
),
population AS (
  SELECT
    s.*,
    substring(md5(s.scenario_id::text || cfg.run_id), 1, 12) AS blind_id,
    regexp_replace(
      COALESCE(s.core_content->>'situation_ko', s.topic, ''),
      '\s+', ' ', 'g'
    ) AS situation_norm
  FROM public.scenarios s
  CROSS JOIN settings cfg
  WHERE s.generation_run_id = cfg.run_id
    AND s.mode = 'stt_interpreting'
),
flags AS (
  SELECT
    p.*,
    situation_norm ~ '(학습자|학생)(는|은|가)?[^.!?。！？]{0,40}(한국어|중국어)[ ]*(원)?화자(로서|이다|이며|역할)'
      OR situation_norm ~ '(한국어|중국어)[ ]*(원)?화자[^.!?。！？]{0,40}(학습자|학생)(이다|이며|로서|역할)'
      AS learner_as_source_candidate,
    situation_norm ~ '(학습자|학생)(는|은|가)?[^.!?。！？]{0,40}(중국어[ ]*청자|중국인[ ]*청자|수신자)(로서|이다|이며|역할)'
      AS learner_as_target_candidate,
    situation_norm ~ '(학습자|학생)(는|은|가)?[^.!?。！？]{0,50}(직접|스스로)[^.!?。！？]{0,25}(요청|거절|사과|감사|제안|초대|반대|찬성|칭찬|불만)'
      AS learner_direct_act_candidate,
    situation_norm !~ '(통역|학습자|학생)' AS missing_interpreter_marker,
    situation_norm !~ '(한국어|한국인|한국 측|원발화자|발화자|화자[ ]*A|A는)' AS missing_source_marker,
    situation_norm !~ '(중국어|중국인|중국 측|목표언어|청자|수신자|화자[ ]*B|B는)' AS missing_target_marker
  FROM population p
)
SELECT
  CASE
    WHEN learner_as_source_candidate
      OR learner_as_target_candidate
      OR learner_direct_act_candidate THEN 'P1_explicit_overlap_candidate'
    WHEN missing_interpreter_marker
      OR missing_source_marker
      OR missing_target_marker THEN 'P2_missing_role_marker'
    ELSE 'P3_no_regex_flag'
  END AS screening_priority,
  blind_id,
  scenario_id,
  generation_item_key,
  speech_act,
  learner_level,
  domain,
  learner_as_source_candidate,
  learner_as_target_candidate,
  learner_direct_act_candidate,
  missing_interpreter_marker,
  missing_source_marker,
  missing_target_marker,
  situation_norm AS situation_ko,
  COALESCE(
    core_content->>'source_text',
    core_content->>'source_text_ko',
    source_text,
    ''
  ) AS source_text
FROM flags
ORDER BY screening_priority, speech_act, learner_level, blind_id;
