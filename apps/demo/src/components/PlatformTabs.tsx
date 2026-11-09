import { useRef, type KeyboardEvent } from 'react';
import type { Dict } from '../i18n';
import type { Channel } from '../sim/types';

const ORDER: ReadonlyArray<Channel> = ['instagram_dm', 'messenger', 'instagram_comment', 'facebook_comment'];

/** Own generic glyphs (no trademark artwork): camera square, lightning bubble, and two comment bubbles with a text badge. */
function PlatformGlyph({ id }: { id: Channel }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (id) {
    case 'instagram_dm':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5.2" />
          <circle cx="12" cy="12" r="3.9" />
          <circle cx="17" cy="7" r=".9" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'messenger':
      return (
        <svg {...common}>
          <path d="M12 3.5c-4.7 0-8.5 3.5-8.5 7.9 0 2.4 1.2 4.5 3.1 5.9V20l3-1.7c.8.2 1.6.3 2.4.3 4.7 0 8.5-3.5 8.5-7.9S16.7 3.5 12 3.5z" />
          <path d="m13.3 7.4-4.5 5h3l-1 4.2 4.6-5.2h-3.1z" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M5.2 4.5h13.6a1.7 1.7 0 0 1 1.7 1.7v8.6a1.7 1.7 0 0 1-1.7 1.7h-6.6L8 20.2v-3.7H5.2a1.7 1.7 0 0 1-1.7-1.7V6.2a1.7 1.7 0 0 1 1.7-1.7z" />
          <path d="M7.6 9h8.8M7.6 12.4h5.4" />
        </svg>
      );
  }
}

export function PlatformTabs({ t, channel, onChannel, locked }: { t: Dict; channel: Channel; onChannel: (c: Channel) => void; locked: boolean }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = ORDER.indexOf(channel);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % ORDER.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur + ORDER.length - 1) % ORDER.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ORDER.length - 1;
    if (next < 0) return;
    e.preventDefault();
    if (locked) return;
    onChannel(ORDER[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div className="platforms" role="tablist" aria-label={t.modeGroup} onKeyDown={onKey}>
      {ORDER.map((id, i) => {
        const on = channel === id;
        const badge = id === 'instagram_comment' ? 'IG' : id === 'facebook_comment' ? 'FB' : null;
        return (
          <button
            key={id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`tab-${id}`}
            aria-selected={on}
            aria-controls="device-screen"
            tabIndex={on ? 0 : -1}
            data-mode={id}
            className={`pf pf-${id} ${on ? 'on' : ''}`}
            disabled={locked && !on}
            onClick={() => onChannel(id)}
          >
            <span className="pf-ico">
              <PlatformGlyph id={id} />
              {badge && <i className={`pf-badge ${badge === 'IG' ? 'ig' : 'fb'}`} aria-hidden="true">{badge}</i>}
            </span>
            <span className="pf-label">{t.modes[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
