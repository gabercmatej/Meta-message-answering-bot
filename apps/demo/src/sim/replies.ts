import { BOOKING_URL, FIRM } from './knowledge';
import type { Lang, Topic } from './types';

/**
 * Scripted reply texts for the simulation. They stand in for model-written drafts and approved
 * fixed texts. They are general and safe by construction: no assessment of a specific case,
 * no deadlines, no promised outcomes. Slovenian texts use formal address (vikanje), as the
 * production release requires.
 */

type Texts = Record<Lang, string>;

export const DRAFTS: Partial<Record<Topic, Texts>> = {
  greeting: {
    en: `Hello, and thank you for contacting ${FIRM.en}. How can we help you?`,
    sl: `Pozdravljeni in hvala, ker ste se obrnili na ${FIRM.sl}. Kako vam lahko pomagamo?`
  },
  unclear: {
    en: 'Thank you for your message. Could you tell us a little more about what you need help with, so we can point you in the right direction?',
    sl: 'Hvala za vaše sporočilo. Bi nam lahko na kratko opisali, pri čem potrebujete pomoč, da vas lahko ustrezno usmerimo?'
  },
  price: {
    en: `A 30-minute phone consultation with a lawyer costs €49. You can book it through the form at ${BOOKING_URL}.`,
    sl: `30-minutni telefonski posvet s pravnikom stane 49 €. Naročite ga lahko prek obrazca na ${BOOKING_URL}.`
  },
  availability: {
    en: `Consultations run on weekdays from 8:00 to 16:00, by phone or video. You can choose a time at ${BOOKING_URL}.`,
    sl: `Posveti potekajo ob delavnikih med 8.00 in 16.00, po telefonu ali videu. Termin lahko izberete na ${BOOKING_URL}.`
  },
  booking: {
    en: `Of course. You can book a consultation with a lawyer through the form at ${BOOKING_URL}; you choose the time that suits you.`,
    sl: `Seveda. Posvet s pravnikom lahko naročite prek obrazca na ${BOOKING_URL}, kjer izberete termin, ki vam ustreza.`
  },
  employment_termination: {
    en: `Thank you for your question. Whether a dismissal is lawful depends on the circumstances, so we can't assess a specific case in a message. In a consultation, a lawyer reviews your employment contract and the notice you received and explains your options. You can book one at ${BOOKING_URL}.`,
    sl: `Hvala za vaše vprašanje. Ali je odpoved zakonita, je odvisno od okoliščin, zato posameznega primera v sporočilu ne moremo presoditi. Na posvetu pravnik pregleda vašo pogodbo o zaposlitvi in prejeto odpoved ter vam pojasni možnosti. Posvet lahko naročite na ${BOOKING_URL}.`
  },
  unpaid_salary: {
    en: `We're sorry to hear that. In a consultation, a lawyer can go through your employment contract and payslips with you and explain the possible next steps. Please have those documents ready. You can book at ${BOOKING_URL}.`,
    sl: `Žal nam je, da se soočate s tem. Na posvetu lahko pravnik z vami pregleda pogodbo o zaposlitvi in plačilne liste ter pojasni možne naslednje korake. Priporočamo, da dokumente pripravite. Posvet naročite na ${BOOKING_URL}.`
  },
  tenancy: {
    en: `Thank you for reaching out. For tenancy disputes, the lease agreement and any written correspondence with the landlord are the most useful documents. A lawyer can review them in a consultation, which you can book at ${BOOKING_URL}.`,
    sl: `Hvala, ker ste nam pisali. Pri najemnih sporih sta najbolj koristna najemna pogodba in pisna korespondenca z najemodajalcem. Pravnik ju lahko pregleda na posvetu, ki ga naročite na ${BOOKING_URL}.`
  },
  consumer: {
    en: `Thank you for your message. For a consumer complaint, the receipt, the order confirmation and any written complaint to the seller are useful. A lawyer can explain the options in a consultation, bookable at ${BOOKING_URL}.`,
    sl: `Hvala za vaše sporočilo. Pri potrošniški težavi so koristni račun, potrdilo o naročilu in pisna reklamacija prodajalcu. Pravnik vam lahko možnosti pojasni na posvetu, ki ga naročite na ${BOOKING_URL}.`
  },
  family: {
    en: `Thank you for trusting us with this. Family matters are best discussed in a confidential consultation, where a lawyer can explain the general process and your options. You can book one at ${BOOKING_URL}.`,
    sl: `Hvala za zaupanje. Družinske zadeve je najbolje obravnavati na zaupnem posvetu, kjer vam pravnik pojasni splošen postopek in možnosti. Posvet lahko naročite na ${BOOKING_URL}.`
  },
  inheritance: {
    en: `Thank you for your question. Wills and inheritance are governed by general rules that a lawyer can explain, but we can't assess a specific situation in a message. In a consultation, a lawyer can walk you through the options. You can book one at ${BOOKING_URL}.`,
    sl: `Hvala za vaše vprašanje. Oporoke in dedovanje urejajo splošna pravila, ki vam jih lahko pojasni pravnik, posamezne situacije pa v sporočilu ne moremo presoditi. Na posvetu vam pravnik predstavi možnosti. Posvet lahko naročite na ${BOOKING_URL}.`
  },
  general_legal: {
    en: `Thank you for your question. We can't give advice on a specific case in a message, but a lawyer can explain the general rules and how they apply to you in a consultation. You can book one at ${BOOKING_URL}.`,
    sl: `Hvala za vaše vprašanje. Nasveta za posamezen primer v sporočilu ne moremo dati, na posvetu pa vam pravnik pojasni splošna pravila in kako veljajo za vas. Posvet lahko naročite na ${BOOKING_URL}.`
  },
  thanks: {
    en: 'Thank you for your kind words! We are glad we could help.',
    sl: 'Najlepša hvala za vaše prijazne besede! Veseli nas, da smo vam lahko pomagali.'
  },
  off_topic: {
    en: `Thank you for your message. ${FIRM.en} can help with legal questions and consultations; if you have one, we're happy to help.`,
    sl: `Hvala za vaše sporočilo. ${FIRM.sl} vam lahko pomaga pri pravnih vprašanjih in posvetih; če ga imate, vam z veseljem pomagamo.`
  }
};

/** Approved fixed texts (owner-approved in the release; never model-written). */
export const APPROVED = {
  fallback: {
    en: `Thank you for your message. A lawyer can look at your question in a consultation; you can book one at ${BOOKING_URL}.`,
    sl: `Hvala za vaše sporočilo. Pravnik si lahko vaše vprašanje ogleda na posvetu, ki ga naročite na ${BOOKING_URL}.`
  },
  complaint: {
    en: 'Thank you for telling us, and we are sorry about your experience. We have passed your message on so the team can follow up with you.',
    sl: 'Hvala, ker ste nam to sporočili, in opravičujemo se za vašo izkušnjo. Vaše sporočilo smo posredovali, da vas lahko ekipa kontaktira.'
  },
  publicSuffix: {
    en: ' For details, please send us a private message: we never discuss personal details in public comments.',
    sl: ' Za podrobnosti nam prosimo pišite v zasebno sporočilo, saj osebnih podrobnosti ne obravnavamo v javnih komentarjih.'
  }
} as const satisfies Record<string, Texts>;
