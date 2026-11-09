import type { HistoryTurn, Topic } from './types';

/**
 * Deterministic keyword matcher that stands in for the production understanding model.
 * It is intentionally simple and transparent: it exists so that any typed message produces a
 * visible, explainable route through the pipeline. It is NOT the production classifier, and its
 * word lists were written for this demo.
 */

export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9€?!\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Rule {
  topic: Topic;
  /** Folded stems; a stem matches at a word start. */
  stems: string[];
  weight: number;
}

// Order matters only for ties; safety rules carry the highest weight.
const RULES: Rule[] = [
  { topic: 'distress', weight: 100, stems: ['hurt myself', 'kill myself', 'end my life', 'suicid', 'threaten to kill', 'he will kill', 'in danger', 'samomor', 'ubil bom', 'ubila bom', 'koncati zivljenje', 'v nevarnosti', 'me bo ubil'] },
  { topic: 'complaint_about_us', weight: 9, stems: ['your service is', 'you are useless', 'terrible service', 'never answered me', 'vasa storitev je', 'slaba storitev', 'niste odgovorili', 'nezadovolj'] },
  { topic: 'unpaid_salary', weight: 8, stems: ['unpaid', 'not paid', 'hasnt paid', 'has not paid', 'didnt pay', 'salary', 'wage', 'paycheck', 'ne izplaca', 'neizplac', 'ni izplacal', 'placa ', 'place ', 'placo ', 'plac ', 'regres'] },
  { topic: 'employment_termination', weight: 8, stems: ['fire me', 'fired', 'dismiss', 'terminat', 'notice period', 'laid off', 'odpoved', 'odpusti', 'odpustil', 'odpovedni rok', 'izgubil sluzbo', 'izgubila sluzbo'] },
  { topic: 'tenancy', weight: 8, stems: ['landlord', 'tenant', 'rent', 'lease', 'deposit', 'evict', 'najem', 'varscin', 'izselit', 'stanovanj'] },
  { topic: 'consumer', weight: 7, stems: ['refund', 'warranty', 'broken product', 'faulty', 'shop', 'store', 'seller', 'online order', 'reklamacij', 'garancij', 'trgovin', 'prodajal', 'vracilo denarja', 'pokvarjen'] },
  { topic: 'family', weight: 8, stems: ['divorce', 'custody', 'alimony', 'child support', 'separation', 'locitev', 'loceni', 'skrbnist', 'prezivnin', 'stik z otrok'] },
  { topic: 'inheritance', weight: 8, stems: ['a will', 'my will', 'last will', 'inherit', 'testament', 'heir', 'oporok', 'dedisc', 'dedovan', 'dedic', 'zapuscin'] },
  { topic: 'price', weight: 6, stems: ['price', 'cost', 'how much', 'fee', 'expensive', 'koliko stane', 'cena', 'cene', 'stane', 'koliko bi', 'placilo posveta', 'placat', 'koliko moram'] },
  { topic: 'booking', weight: 6, stems: ['book', 'appointment', 'schedule a', 'talk to a lawyer', 'speak to a lawyer', 'call me', 'narocit', 'narocim', 'termin', 'pogovor s pravnik', 'poklicite me'] },
  { topic: 'availability', weight: 5, stems: ['open', 'hours', 'weekend', 'saturday', 'sunday', 'available', 'by phone', 'online', 'video', 'delovni cas', 'sobot', 'nedelj', 'odprt', 'po telefonu', 'dosegljiv', 'kdaj delate'] },
  { topic: 'general_legal', weight: 4, stems: ['law', 'legal', 'lawyer', 'rights', 'contract', 'court', 'sue', 'zakon', 'pravn', 'pravic', 'pogodb', 'sodisc', 'tozb'] },
  { topic: 'thanks', weight: 3, stems: ['thank', 'thanks', 'great help', 'appreciate', 'hvala', 'super', 'odlicn', 'pohvala'] },
  { topic: 'greeting', weight: 2, stems: ['hi', 'hello', 'hey', 'good morning', 'zivjo', 'pozdravljeni', 'pozdrav', 'dober dan', 'zdravo', 'hej'] },
  { topic: 'off_topic', weight: 3, stems: ['weather', 'football', 'recipe', 'pizza', 'movie', 'bitcoin', 'vreme', 'nogomet', 'recept', 'film', 'kripto'] }
];

export interface MatchResult {
  topic: Topic;
  matchedTerms: string[];
  fromContext: boolean;
}

function matches(folded: string, stem: string): boolean {
  // Word-start match; a trailing space in a stem means "whole word". Short stems are whole words.
  const padded = ` ${folded.replace(/[?!]/g, ' ')} `;
  const s = stem.trim().length <= 3 ? `${stem.trim()} ` : stem;
  return padded.includes(` ${s}`);
}

const LEGAL_TOPICS: ReadonlySet<Topic> = new Set(['employment_termination', 'unpaid_salary', 'tenancy', 'consumer', 'family', 'inheritance', 'general_legal', 'price', 'availability', 'booking']);

export function matchTopic(text: string, history: ReadonlyArray<HistoryTurn> = []): MatchResult {
  const folded = fold(text);
  let best: { topic: Topic; score: number; terms: string[] } | null = null;
  for (const rule of RULES) {
    const terms = rule.stems.filter((s) => matches(folded, s));
    if (terms.length === 0) continue;
    const score = rule.weight * 10 + terms.length;
    if (!best || score > best.score) best = { topic: rule.topic, score, terms: terms.map((t) => t.trim()) };
  }
  if (best) {
    // A greeting that also contains a real question is classified by the question.
    return { topic: best.topic, matchedTerms: best.terms, fromContext: false };
  }
  // Short follow-up ("and on weekends?", "in po telefonu?") inherits the previous user topic.
  const words = folded.split(' ').filter(Boolean);
  const previous = [...history].reverse().find((t) => t.role === 'user' && t.topic && LEGAL_TOPICS.has(t.topic));
  if (previous?.topic && words.length > 0 && words.length <= 6) {
    return { topic: previous.topic, matchedTerms: [], fromContext: true };
  }
  // Nothing recognised: the safe general route is a clarifying question.
  return { topic: 'unclear', matchedTerms: [], fromContext: false };
}
