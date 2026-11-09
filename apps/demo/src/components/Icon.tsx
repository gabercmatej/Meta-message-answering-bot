import type { JSX } from 'react';

/** Own inline glyphs (stroke 1.5, 24px grid). No third-party or platform artwork. */
const P: Record<string, JSX.Element> = {
  // architecture nodes
  webhook: <><circle cx="6.5" cy="17" r="2.5" /><circle cx="17.5" cy="17" r="2.5" /><circle cx="12" cy="6.5" r="2.5" /><path d="M12 9v3.2l-4.2 3M13.6 8.7l4.2 6.2M9 17h6" /></>,
  shield: <><path d="M12 3.2 5 6v5.6c0 4.2 2.9 7.4 7 9.2 4.1-1.8 7-5 7-9.2V6z" /><path d="m9 12 2.2 2.2L15.2 10" /></>,
  layers: <path d="m12 4 8.5 4.5L12 13 3.5 8.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />,
  queue: <><rect x="4" y="5" width="16" height="3.6" rx="1.2" /><rect x="4" y="10.2" width="16" height="3.6" rx="1.2" /><rect x="4" y="15.4" width="16" height="3.6" rx="1.2" /></>,
  context: <path d="M5 5.5h14v10H11l-4 3.3v-3.3H5zM8.5 9h7M8.5 12h4" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></>,
  spark: <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9zM18.5 3.5v3M17 5h3" />,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  db: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" /></>,
  gate: <path d="M12 3.5 20 12l-8 8.5L4 12zM12 9v6M9 12h6" />,
  person: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" /></>,
  pen: <path d="M4 20l1-4.2L16.5 4.3a1.9 1.9 0 0 1 2.7 0l.5.5a1.9 1.9 0 0 1 0 2.7L8.2 19zM14.5 6.3l3.2 3.2" />,
  lifebuoy: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /><path d="m6.3 6.3 3.4 3.4M14.3 14.3l3.4 3.4M17.7 6.3l-3.4 3.4M9.7 14.3l-3.4 3.4" /></>,
  'check-circle': <><circle cx="12" cy="12" r="8.5" /><path d="m8.2 12.3 2.6 2.6 5-5.4" /></>,
  timer: <><circle cx="12" cy="13.5" r="7" /><path d="M12 9.5v4l2.5 1.5M9.5 3.5h5" /></>,
  send: <path d="M20.5 3.5 3.5 10.8l6.3 2.4 2.4 6.3zM9.8 13.2l10.7-9.7" />,
  sync: <path d="M19.5 8A8 8 0 0 0 5 9.5M4.5 4.5v5h5M4.5 16A8 8 0 0 0 19 14.5M19.5 19.5v-5h-5" />,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5S9.5 5.9 12 3.5z" /></>,
  // ui
  'chevron-left': <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  'chevron-right': <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  'chevron-down': <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />,
  'chat-dots': <><path d="M20.2 11.6a8 8 0 0 1-11.6 7.1L4 20l1.3-4.4A8 8 0 1 1 20.2 11.6z" /><circle cx="8.8" cy="11.8" r=".7" fill="currentColor" /><circle cx="12.2" cy="11.8" r=".7" fill="currentColor" /><circle cx="15.6" cy="11.8" r=".7" fill="currentColor" /></>,
  heart: <path d="M12 20.2S4 15.4 4 9.6A4.1 4.1 0 0 1 8.1 5.5c1.7 0 3 .9 3.9 2.4.9-1.5 2.2-2.4 3.9-2.4A4.1 4.1 0 0 1 20 9.6c0 5.8-8 10.6-8 10.6z" />,
  comment: <path d="M20.2 11.6a8 8 0 0 1-11.6 7.1L4 20l1.3-4.4A8 8 0 1 1 20.2 11.6z" />,
  share: <path d="M20.5 3.5 3.5 10.8l6.3 2.4 2.4 6.3zM9.8 13.2l10.7-9.7" />,
  bookmark: <path d="M6.5 4h11v16.5L12 16l-5.5 4.5z" />,
  smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14c.9 1.4 2 2.1 3.5 2.1s2.6-.7 3.5-2.1M9 9.6v.4M15 9.6v.4" /></>,
  image: <><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3 3-2.5 5 4" /></>,
  thumb: <path d="M8 10.5V20H4.5v-9.5zM8 10.5l3.2-6.2c1.3-.2 2.3.8 2.1 2.1L12.7 9.5h5.7c1.1 0 1.9 1 1.7 2.1l-1.2 6.4c-.2 1-1 1.7-2 1.7H8" />,
  more: <><circle cx="5.5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="18.5" cy="12" r="1" fill="currentColor" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  restart: <path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4M4.5 4.5v4.8h4.8" />,
  skip: <path d="M5 5.5v13l8-6.5zM15.5 5.5v13M19 5.5v13" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  code: <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.2" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.3" />,
  'cloud-off': <path d="M4 4l16 16M9 6.2A5.5 5.5 0 0 1 18 10a3.7 3.7 0 0 1 1.8 6.6M6.5 17.5A3.7 3.7 0 0 1 5 10.3 5.5 5.5 0 0 1 6 9.2" />,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8" /></>,
  gauge: <><path d="M4.5 17a8 8 0 1 1 15 0" /><path d="m12 13 3.5-4" /><circle cx="12" cy="13.5" r="1.2" /></>,
  refresh: <path d="M19.5 8A8 8 0 0 0 5 9.5M4.5 4.5v5h5M4.5 16A8 8 0 0 0 19 14.5M19.5 19.5v-5h-5" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2.2" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 13h17" /></>,
  home: <path d="M4 11 12 4l8 7v8.5h-5.5V14h-5v5.5H4z" />,
  bag: <path d="M5.5 8h13l-1 11.5h-11zM9 10.5V7a3 3 0 0 1 6 0v3.5" />,
  people: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.5-3 2.6-4.6 5.5-4.6s5 1.6 5.500 4.600M16 6.3a3 3 0 0 1 0 5.400M17.500 14.600c1.700.600 2.700 2 3 4.400" /></>,
  scroll: <path d="M7 4.5h11v12a3 3 0 0 1-3 3H6.500a2 2 0 0 1-2-2V16H15M7 4.500a2 2 0 0 0-2 2V16M9.5 8.500h5M9.500 11.500h5" />,
  tag: <path d="M3.5 12.500V4.500h8l8.500 8.500-8 8zM8 8.500v.2" />,
  calendar: <><rect x="4" y="5.5" width="16" height="14.500" rx="2.500" /><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4" /></>,
  wave: <path d="M8 11.500V6.500a1.500 1.500 0 0 1 3 0V11M11 10.500V5a1.500 1.500 0 0 1 3 0v6M14 10.500V6.500a1.500 1.500 0 0 1 3 0V13c0 4-2.500 7-6.500 7-2.800 0-4.500-1.700-6-4.200L3.500 13.500a1.500 1.500 0 0 1 2.500-1.500L8 14.500" />,
  help: <><circle cx="12" cy="12" r="8.500" /><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 .9-1 1.700M12 16.500v.2" /></>,
  lock: <><rect x="5" y="10.500" width="14" height="9.500" rx="2.200" /><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500" /></>,
  layout: <><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><path d="M3.500 9.500h17M9.500 9.500v10" /></>,
  phone: <path d="M6 3.500h3l1.500 4-2 1.300a11 11 0 0 0 5.700 5.700l1.300-2 4 1.500v3a2 2 0 0 1-2 2A15.500 15.500 0 0 1 4 5.500a2 2 0 0 1 2-2z" />,
  video: <><rect x="3.500" y="6.500" width="12" height="11" rx="2.500" /><path d="m15.500 10.500 5-3v9l-5-3z" /></>,
  mic: <><rect x="9" y="3.500" width="6" height="11" rx="3" /><path d="M5.500 11.500a6.500 6.500 0 0 0 13 0M12 18v2.500" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  dots: <><circle cx="12" cy="5.500" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="18.500" r="1" fill="currentColor" /></>
};

export function Icon({ name, size = 16, className, stroke = 1.5 }: { name: string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name] ?? null}
    </svg>
  );
}

/** Raw path content for use inside another svg (graph nodes), sized by the caller. */
export function IconPaths({ name }: { name: string }) {
  return <>{P[name] ?? null}</>;
}
