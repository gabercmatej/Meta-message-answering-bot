import { SCENARIOS } from './sim/scenarios';
import type { Lang, Topic } from './sim/types';

/** The four compact chips under the composer. `topic` is what the deterministic matcher yields (asserted in tests). */
export const SUGGESTIONS: Record<Lang, ReadonlyArray<{ text: string; topic: Topic }>> = {
  en: [
    { text: 'Can my employer fire me?', topic: 'employment_termination' },
    { text: 'My landlord wants me out', topic: 'tenancy' },
    { text: 'How much is a consultation?', topic: 'price' },
    { text: 'I haven’t been paid', topic: 'unpaid_salary' }
  ],
  sl: [
    { text: 'Ali me lahko delodajalec odpusti?', topic: 'employment_termination' },
    { text: 'Najemodajalec me želi izseliti', topic: 'tenancy' },
    { text: 'Koliko stane posvet?', topic: 'price' },
    { text: 'Plače nisem prejel', topic: 'unpaid_salary' }
  ]
};

export interface Example {
  id: string;
  icon: string;
  label: Record<Lang, string>;
}

const scenarioIds = new Set(SCENARIOS.map((s) => s.id));

/** Failure modes and reliability cases, each mapped to an existing scenario. */
export const FAILURE_MODES: ReadonlyArray<Example> = [
  { id: 'ai-down', icon: 'cloud-off', label: { en: 'AI unavailable', sl: 'AI ni na voljo' } },
  { id: 'duplicate', icon: 'copy', label: { en: 'Duplicate webhook', sl: 'Podvojen webhook' } },
  { id: 'throttled', icon: 'gauge', label: { en: 'Transient Meta failure (retry)', sl: 'Začasna napaka Mete (ponovni poskus)' } },
  { id: 'unknown-found', icon: 'search', label: { en: 'Uncertain write → read-back found', sl: 'Negotov zapis → branje najde odgovor' } },
  { id: 'unknown-absent', icon: 'refresh', label: { en: 'Uncertain write → absent → resend', sl: 'Negotov zapis → odgovora ni → ponovno pošiljanje' } },
  { id: 'distress', icon: 'person', label: { en: 'Human-only message', sl: 'Sporočilo samo za človeka' } },
  { id: 'scheduled', icon: 'clock', label: { en: 'Scheduled sending', sl: 'Načrtovano pošiljanje' } }
];

export const EVERYDAY: ReadonlyArray<Example> = [
  { id: 'termination', icon: 'briefcase', label: { en: 'Employment termination', sl: 'Odpoved delovnega razmerja' } },
  { id: 'salary', icon: 'briefcase', label: { en: 'Unpaid salary', sl: 'Neizplačana plača' } },
  { id: 'tenancy', icon: 'home', label: { en: 'Landlord / tenant', sl: 'Najem stanovanja' } },
  { id: 'consumer', icon: 'bag', label: { en: 'Consumer complaint', sl: 'Potrošniška reklamacija' } },
  { id: 'family', icon: 'people', label: { en: 'Family law inquiry', sl: 'Družinsko pravo' } },
  { id: 'inheritance', icon: 'scroll', label: { en: 'Wills & inheritance', sl: 'Oporoke in dedovanje' } },
  { id: 'price', icon: 'tag', label: { en: 'Consultation price', sl: 'Cena posveta' } },
  { id: 'availability', icon: 'clock', label: { en: 'Service availability', sl: 'Dosegljivost' } },
  { id: 'booking', icon: 'calendar', label: { en: 'Appointment booking', sl: 'Naročanje termina' } },
  { id: 'hi', icon: 'wave', label: { en: 'Short greeting', sl: 'Kratek pozdrav' } },
  { id: 'unclear', icon: 'help', label: { en: 'Unclear message', sl: 'Nejasno sporočilo' } },
  { id: 'offtopic', icon: 'comment', label: { en: 'Off-topic remark', sl: 'Pripomba mimo teme' } },
  { id: 'complaint', icon: 'alert', label: { en: 'Complaint about us', sl: 'Pritožba nad nami' } }
];

export const ALL_EXAMPLE_IDS: ReadonlyArray<string> = [...EVERYDAY, ...FAILURE_MODES].map((e) => e.id).filter((id) => scenarioIds.has(id));
