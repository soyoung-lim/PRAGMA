-- Fix speech-act 9→2 collapse at write time: extend public.speech_act enum from
-- ('request','refusal') to the full 9-act taxonomy (matrix LOCK 2026-07-18).
-- Existing rows keep their stored values; the true act was previously collapsed
-- (apology→refusal, thanks→request, ...) so historical rows remain approximations —
-- new rows store the true act. Non-breaking: ADD VALUE only.

ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'apology';
ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'thanks';
ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'proposal';
ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'agreement';   -- label 초대 (invitation)
ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'opposition';
ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'compliment';
ALTER TYPE public.speech_act ADD VALUE IF NOT EXISTS 'complaint';
