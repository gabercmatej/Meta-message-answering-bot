import type { Intent, LegalArea, Lang } from './sim/types';

/** Human-readable labels; the machine ids are shown in mono underneath. */
export const INTENT_LABEL: Record<Lang, Record<Intent, string>> = {
  en: { product_question: 'Product question', pricing_promotion: 'Pricing question', praise_thanks: 'Praise or thanks', complaint: 'Complaint', individual_legal_situation: 'Individual legal situation', general_legal_topic: 'General legal topic', threat_sensitive_distress: 'Threat or distress', unclear: 'Unclear', other: 'Other', contact_booking: 'Contact or booking' },
  sl: { product_question: 'Vprašanje o storitvi', pricing_promotion: 'Vprašanje o ceni', praise_thanks: 'Pohvala ali zahvala', complaint: 'Pritožba', individual_legal_situation: 'Posamezna pravna situacija', general_legal_topic: 'Splošna pravna tema', threat_sensitive_distress: 'Grožnja ali stiska', unclear: 'Nejasno', other: 'Drugo', contact_booking: 'Stik ali naročilo' }
};

export const AREA_LABEL: Record<Lang, Record<LegalArea, string>> = {
  en: { delovno: 'Employment law', druzinsko: 'Family law', dedno: 'Inheritance law', stvarno_nepremicnine: 'Property & tenancy', potrosnisko: 'Consumer law', obligacijsko_pogodbe: 'Contract law', drugo: 'Other legal area', ni_pravno: 'Not a legal matter' },
  sl: { delovno: 'Delovno pravo', druzinsko: 'Družinsko pravo', dedno: 'Dedno pravo', stvarno_nepremicnine: 'Stvarno pravo in najem', potrosnisko: 'Potrošniško pravo', obligacijsko_pogodbe: 'Obligacijsko pravo', drugo: 'Drugo pravno področje', ni_pravno: 'Ni pravna zadeva' }
};

const ROUTE_SL: Record<string, string> = {
  'Hard safety signal': 'Trden varnostni signal',
  'No AI text': 'Brez besedila AI',
  'Held for a person': 'Zadržano za osebo',
  'Public remark, no question': 'Javna pripomba brez vprašanja',
  'No reply needed': 'Odgovor ni potreben',
  'AI timeout → approved fallback': 'Časovna omejitev AI → odobrena rezerva',
  'Safe fallback': 'Varna rezerva',
  'Approved text': 'Odobreno besedilo',
  'Grounded reply': 'Utemeljen odgovor',
  'Clarifying reply': 'Razjasnitveni odgovor',
  validated: 'preverjeno',
  'rate limited → retry': 'omejitev hitrosti → ponovni poskus',
  'outcome unknown → absent → resend': 'izid neznan → ni odgovora → ponovno pošiljanje',
  'outcome unknown → read-back found': 'izid neznan → branje najde odgovor',
  reconciled: 'usklajeno',
  delivered: 'dostavljeno'
};

export function routePhrase(s: string, lang: Lang): string {
  if (lang === 'en') return s;
  const m = /^scheduled (\d+) s$/.exec(s);
  if (m) return `načrtovano ${m[1]} s`;
  return ROUTE_SL[s] ?? s;
}

/** Allow line breaks after underscores and dots so codes wrap gracefully. */
export const soft = (s: string): string => s.replace(/_/g, '_​').replace(/\./g, '.​');
