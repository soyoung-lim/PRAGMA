import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  const scenarios = [
    {
      title: '테스트 시나리오 1',
      speech_act: 'request',
      industry_sector: 'IT',
      source_text: '이 보고서를 내일까지 완성해 주실 수 있나요?',
      review_status: 'approved',
      language_direction: 'ko_to_zh'
    },
    {
      title: '테스트 시나리오 2',
      speech_act: 'refusal',
      industry_sector: '금융',
      source_text: '죄송하지만 그 제안은 받아들이기 어렵습니다.',
      review_status: 'approved',
      language_direction: 'ko_to_zh'
    }
  ];

  const { error } = await supabase.from('scenarios').insert(scenarios);
  if (error) console.error('Seed error:', error);
  else console.log('Seeded 2 approved scenarios');
}

seed();
