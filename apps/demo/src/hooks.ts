import { useEffect, useState } from 'react';

export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches;
  const [v, setV] = useState(get);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setV(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return v;
}

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
