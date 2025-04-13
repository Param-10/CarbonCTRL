import { useEffect } from 'react';

export function TestEnv() {
  useEffect(() => {
    console.log('Testing environment variables:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY);
  }, []);

  return <div>Check console for environment variables</div>;
} 