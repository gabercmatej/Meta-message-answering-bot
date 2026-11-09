import type { Channel, Fault, Lang, ReplyState } from './types';

export interface Scenario {
  id: string;
  group: 'Legal topics' | 'Service' | 'Conversation' | 'Reliability';
  label: string;
  channel: Channel;
  text: Record<Lang, string>;
  fault: Fault;
  /** Terminal reply-item state the scenario is expected to reach (asserted in tests). */
  expect: ReplyState;
  note: string;
}

export const SCENARIOS: ReadonlyArray<Scenario> = [
  { id: 'termination', group: 'Legal topics', label: 'Employment termination', channel: 'instagram_dm', fault: 'none', expect: 'sent', note: 'Bounded legal orientation, grounded and auto-sent.', text: { en: 'Can my employer fire me without notice?', sl: 'Ali me lahko delodajalec odpusti brez odpovednega roka?' } },
  { id: 'salary', group: 'Legal topics', label: 'Unpaid salary', channel: 'messenger', fault: 'none', expect: 'sent', note: 'Personal situation → orientation, no case assessment.', text: { en: 'My employer has not paid my salary for two months.', sl: 'Delodajalec mi že dva meseca ne izplača plače.' } },
  { id: 'tenancy', group: 'Legal topics', label: 'Landlord / tenant', channel: 'facebook_comment', fault: 'none', expect: 'sent', note: 'Public comment: adds the privacy sentence.', text: { en: 'My landlord refuses to return my deposit. What can I do?', sl: 'Najemodajalec mi noče vrniti varščine. Kaj lahko naredim?' } },
  { id: 'consumer', group: 'Legal topics', label: 'Consumer complaint', channel: 'messenger', fault: 'none', expect: 'sent', note: 'Consumer area guidance retrieved.', text: { en: 'The shop refuses a refund for a faulty phone.', sl: 'Trgovina noče sprejeti reklamacije za pokvarjen telefon.' } },
  { id: 'family', group: 'Legal topics', label: 'Family law inquiry', channel: 'instagram_dm', fault: 'none', expect: 'sent', note: 'Sensitive area, still general orientation only.', text: { en: 'How does custody work after a divorce?', sl: 'Kako poteka dogovor o skrbništvu po ločitvi?' } },
  { id: 'inheritance', group: 'Legal topics', label: 'Wills & inheritance', channel: 'instagram_comment', fault: 'none', expect: 'sent', note: 'General question about wills, classified as the inheritance area (dedno).', text: { en: 'Do I need a lawyer to write a will?', sl: 'Ali potrebujem pravnika za sestavo oporoke?' } },
  { id: 'price', group: 'Service', label: 'Consultation price', channel: 'messenger', fault: 'none', expect: 'sent', note: 'Price only from an approved price entry.', text: { en: 'How much does a legal consultation cost?', sl: 'Koliko stane pravni posvet?' } },
  { id: 'availability', group: 'Service', label: 'Service availability', channel: 'facebook_comment', fault: 'none', expect: 'sent', note: 'FAQ entry, grounded.', text: { en: 'Are you available on Saturdays?', sl: 'Ali delate tudi ob sobotah?' } },
  { id: 'booking', group: 'Service', label: 'Appointment booking', channel: 'instagram_dm', fault: 'none', expect: 'sent', note: 'Approved contact route.', text: { en: 'I would like to book an appointment with a lawyer.', sl: 'Rad bi naročil termin za posvet s pravnikom.' } },
  { id: 'hi', group: 'Conversation', label: 'Short greeting', channel: 'messenger', fault: 'none', expect: 'sent', note: 'Clarifying question, not silence.', text: { en: 'Hi', sl: 'Živjo' } },
  { id: 'unclear', group: 'Conversation', label: 'Unclear message', channel: 'instagram_dm', fault: 'none', expect: 'sent', note: 'Nothing recognised → safe clarification.', text: { en: 'hmm so about that thing', sl: 'hmm glede tistega' } },
  { id: 'offtopic', group: 'Conversation', label: 'Off-topic remark', channel: 'facebook_comment', fault: 'none', expect: 'skipped', note: 'Public chatter without a question is skipped.', text: { en: 'Great weather for football today', sl: 'Danes je super vreme za nogomet' } },
  { id: 'complaint', group: 'Conversation', label: 'Complaint about us', channel: 'messenger', fault: 'none', expect: 'sent', note: 'Owner-approved acknowledgement + follow-up flag.', text: { en: 'Terrible service, you never answered me last week.', sl: 'Slaba storitev, prejšnji teden mi niste odgovorili.' } },
  { id: 'distress', group: 'Conversation', label: 'Distress → human', channel: 'instagram_dm', fault: 'none', expect: 'needs_review', note: 'Hard safety signal: no AI text, a person decides.', text: { en: 'I am in danger and I don’t know what to do', sl: 'V nevarnosti sem in ne vem, kaj naj naredim' } },
  { id: 'ai-down', group: 'Reliability', label: 'AI provider unavailable', channel: 'messenger', fault: 'ai_unavailable', expect: 'sent', note: 'Timeout → approved fallback, still answered.', text: { en: 'Can my employer fire me without notice?', sl: 'Ali me lahko delodajalec odpusti brez odpovednega roka?' } },
  { id: 'scheduled', group: 'Reliability', label: 'Scheduled sending', channel: 'facebook_comment', fault: 'none', expect: 'sent', note: 'Watch the configurable delay count down.', text: { en: 'How much does a consultation cost?', sl: 'Koliko stane posvet?' } },
  { id: 'duplicate', group: 'Reliability', label: 'Duplicate webhook', channel: 'instagram_dm', fault: 'duplicate_webhook', expect: 'sent', note: 'Same event twice → exactly one reply.', text: { en: 'How much does a legal consultation cost?', sl: 'Koliko stane pravni posvet?' } },
  { id: 'throttled', group: 'Reliability', label: 'Transient Meta failure', channel: 'messenger', fault: 'meta_throttled', expect: 'sent', note: 'Rate limited → backoff → retry succeeds.', text: { en: 'Are you available on Saturdays?', sl: 'Ali delate tudi ob sobotah?' } },
  { id: 'unknown-absent', group: 'Reliability', label: 'Lost write → resend', channel: 'instagram_comment', fault: 'outcome_unknown_absent', expect: 'sent', note: 'Timeout after write → read-back absent → resend.', text: { en: 'Do I need a lawyer to write a will?', sl: 'Ali potrebujem pravnika za sestavo oporoke?' } },
  { id: 'unknown-found', group: 'Reliability', label: 'Lost write → reconciled', channel: 'messenger', fault: 'outcome_unknown_found', expect: 'reconciled_sent', note: 'Read-back finds the reply: no second write.', text: { en: 'I would like to book an appointment.', sl: 'Rad bi naročil termin.' } }
];

export const DEFAULT_SCENARIO_ID = 'termination';
