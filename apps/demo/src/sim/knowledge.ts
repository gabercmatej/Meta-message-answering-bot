import type { KnowledgeEntry } from './types';

/**
 * FICTIONAL demo knowledge. "Demo Legal Desk" does not exist; every price, link and service fact
 * here is invented for the simulation and is labelled as such in the UI. None of it is the
 * production knowledge base of any real business.
 */
export const FIRM = { en: 'Demo Legal Desk', sl: 'Demo pravna pisarna' } as const;
export const BOOKING_URL = 'https://example.com/book';

export const KNOWLEDGE: ReadonlyArray<KnowledgeEntry> = [
  {
    id: 'kb.price.consult',
    version: 3,
    type: 'price',
    areas: ['ni_pravno'],
    title: { en: 'Consultation price', sl: 'Cena posveta' },
    body: {
      en: 'A 30-minute phone consultation with a lawyer costs €49 (fictional demo fact).',
      sl: '30-minutni telefonski posvet s pravnikom stane 49 € (izmišljen demo podatek).'
    },
    keywords: ['price', 'cost', 'how much', 'fee', 'cena', 'stane', 'koliko', 'plačilo', 'posvet', 'consultation']
  },
  {
    id: 'kb.service.written-opinion',
    version: 2,
    type: 'service_fact',
    areas: ['ni_pravno'],
    title: { en: 'Written opinion & documents', sl: 'Pisno mnenje in dokumenti' },
    body: {
      en: 'After a consultation, a written opinion or document review can be ordered (fictional demo fact).',
      sl: 'Po posvetu lahko naročite pisno mnenje ali pregled dokumenta (izmišljen demo podatek).'
    },
    keywords: ['contract', 'document', 'review', 'pogodba', 'dokument', 'pregled', 'mnenje']
  },
  {
    id: 'kb.service.hours',
    version: 4,
    type: 'faq',
    areas: ['ni_pravno'],
    title: { en: 'Availability', sl: 'Dosegljivost' },
    body: {
      en: 'Consultations run on weekdays 8:00–16:00, by phone or video (fictional demo fact).',
      sl: 'Posveti potekajo ob delavnikih med 8.00 in 16.00, po telefonu ali videu (izmišljen demo podatek).'
    },
    keywords: ['open', 'hours', 'weekend', 'saturday', 'available', 'when', 'delovni čas', 'sobota', 'kdaj', 'odprto']
  },
  {
    id: 'kb.route.booking',
    version: 5,
    type: 'contact_route',
    areas: ['ni_pravno'],
    title: { en: 'Booking route', sl: 'Naročilo posveta' },
    body: {
      en: `Book a consultation through the booking form at ${BOOKING_URL}.`,
      sl: `Posvet naročite prek obrazca na ${BOOKING_URL}.`
    },
    keywords: ['book', 'appointment', 'schedule', 'contact', 'naročiti', 'termin', 'kontakt', 'naročim']
  },
  {
    id: 'kb.boundary.no-individual-advice',
    version: 1,
    type: 'policy_boundary',
    areas: ['delovno', 'druzinsko', 'dedno', 'stvarno_nepremicnine', 'potrosnisko', 'obligacijsko_pogodbe', 'drugo'],
    title: { en: 'No individual advice in messages', sl: 'Brez nasveta za posamezen primer' },
    body: {
      en: 'Messages give general orientation only: no assessment of a specific case, no deadlines, no promised outcomes.',
      sl: 'V sporočilih dajemo le splošno usmeritev: brez presoje primera, brez rokov in brez obljub izida.'
    },
    keywords: []
  },
  {
    id: 'kb.area.employment',
    version: 2,
    type: 'legal_area_guidance',
    areas: ['delovno'],
    title: { en: 'Employment matters', sl: 'Delovnopravne zadeve' },
    body: {
      en: 'For employment questions a lawyer reviews the contract, notices and payslips during the consultation.',
      sl: 'Pri delovnopravnih vprašanjih pravnik na posvetu pregleda pogodbo, odpoved in plačilne liste.'
    },
    keywords: ['employer', 'fired', 'notice', 'salary', 'delodajalec', 'odpoved', 'plača', 'služba']
  },
  {
    id: 'kb.area.tenancy',
    version: 1,
    type: 'legal_area_guidance',
    areas: ['stvarno_nepremicnine', 'obligacijsko_pogodbe'],
    title: { en: 'Tenancy matters', sl: 'Najemne zadeve' },
    body: {
      en: 'For tenancy disputes, the lease agreement and written correspondence with the landlord are the useful documents.',
      sl: 'Pri najemnih sporih sta koristna najemna pogodba in pisna korespondenca z najemodajalcem.'
    },
    keywords: ['landlord', 'rent', 'lease', 'deposit', 'najem', 'najemnina', 'najemodajalec', 'varščina']
  },
  {
    id: 'kb.area.consumer',
    version: 1,
    type: 'legal_area_guidance',
    areas: ['potrosnisko'],
    title: { en: 'Consumer matters', sl: 'Potrošniške zadeve' },
    body: {
      en: 'For consumer complaints, the receipt, the order and any written complaint to the seller are useful.',
      sl: 'Pri potrošniških težavah so koristni račun, naročilo in pisna reklamacija prodajalcu.'
    },
    keywords: ['refund', 'shop', 'warranty', 'seller', 'reklamacija', 'trgovina', 'garancija', 'vračilo']
  },
  {
    id: 'kb.area.inheritance',
    version: 1,
    type: 'legal_area_guidance',
    areas: ['dedno'],
    title: { en: 'Inheritance & wills', sl: 'Dedovanje in oporoke' },
    body: {
      en: 'For wills and inheritance, a lawyer explains the general rules in a consultation; messages never assess a specific estate.',
      sl: 'Pri oporokah in dedovanju pravnik na posvetu pojasni splošna pravila; v sporočilih posamezne zapuščine ne presojamo.'
    },
    keywords: ['will', 'inherit', 'heir', 'estate', 'oporoka', 'oporoke', 'dedovanje', 'dedič', 'zapuščina']
  },
  {
    id: 'kb.area.family',
    version: 1,
    type: 'legal_area_guidance',
    areas: ['druzinsko'],
    title: { en: 'Family matters', sl: 'Družinske zadeve' },
    body: {
      en: 'Family matters are discussed in a confidential consultation; messages never ask for personal details.',
      sl: 'Družinske zadeve obravnavamo na zaupnem posvetu; v sporočilih ne sprašujemo po osebnih podatkih.'
    },
    keywords: ['divorce', 'custody', 'alimony', 'ločitev', 'skrbništvo', 'preživnina', 'otrok']
  }
];

export function entry(id: string): KnowledgeEntry {
  const found = KNOWLEDGE.find((k) => k.id === id);
  if (!found) throw new Error(`unknown demo knowledge entry ${id}`);
  return found;
}
