import { supabase } from '../src/integrations/supabase/client';

async function check() {
  const { data, error } = await supabase.from('scenarios').select('*');
  if (error) {
    console.error('Error fetching scenarios:', error);
  } else {
    console.log('Total scenarios:', data?.length);
    console.log('Statuses:', data?.map(s => s.review_status));
  }
}
check();
