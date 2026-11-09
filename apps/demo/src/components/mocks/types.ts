import type { Dict } from '../../i18n';
import type { Lang } from '../../sim/types';

export interface ConvItem {
  id: string;
  role: 'user' | 'bot' | 'system';
  text: string;
  tone?: 'auto' | 'fallback' | 'hold' | 'skip';
}

export type DeliveryStatus = 'sent' | 'delivered' | 'seen' | null;

export interface MockProps {
  t: Dict;
  lang: Lang;
  items: ConvItem[];
  typing: boolean;
  status: DeliveryStatus;
  busy: boolean;
  draft: string;
  setDraft: (s: string) => void;
  onSend: () => void;
}
