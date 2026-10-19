import { APPLY_LABELS, DAYS, EXPERIENCE, PARTNER, SKILLS, TRANSPORT } from "@/lib/content"
import type { Trio } from "../strings"

// The "Become a pro" pages (/partner, /partner/apply, /partner/thanks, /partner/interview) in
// English, Urdu and Roman Urdu: the visitor switches language on the page. Edited in Pages →
// Become a pro. Option ids (skills, days…) are fixed in code because applications store them;
// only their labels are editable. The built-in copy comes from lib/content.

const trio = ({ en, ur, ro }: Trio): Trio => ({ en, ur, ro })
const byId = <K extends string>(list: (Trio & { id: string })[], keys: Record<string, K>) => Object.fromEntries(list.map((x) => [keys[x.id], trio(x)])) as Record<K, Trio>
const same = <S extends string>(ids: readonly S[]) => Object.fromEntries(ids.map((i) => [i, i])) as Record<S, S>

/** Option id → field key (field keys must be plain words). */
export const EXPERIENCE_KEY = { "<1": "under1", "1-3": "y1to3", "3-5": "y3to5", "5+": "y5plus" } as const
export const BENEFIT_KEYS = ["payouts", "days", "transport", "team", "training", "kits"] as const
export const STEP_KEYS = ["apply", "interview", "test", "training", "first"] as const
const SKILL_IDS = ["waxing", "threading", "facials", "mani-pedi", "hair", "makeup", "mehndi", "nails-lashes", "massage"] as const
const SKILL_KEY = { ...same(SKILL_IDS), "mani-pedi": "maniPedi", "nails-lashes": "nailsLashes" } as const
export { SKILL_KEY }

export const PARTNER_TEXT = {
  landing: {
    h1: trio(PARTNER.h1),
    sub: trio(PARTNER.sub),
    cta: trio(PARTNER.cta),
    voice: trio(PARTNER.voice),
    voiceMessage: { en: "Assalam o Alaikum! Main Mjazo ke saath kaam karna chahti hoon. (Voice note attached)", ur: "السلام علیکم! میں مجازو کے ساتھ کام کرنا چاہتی ہوں۔ (وائس نوٹ ساتھ ہے)", ro: "Assalam o Alaikum! Main Mjazo ke saath kaam karna chahti hoon. (Voice note attached)" },
    note: trio(PARTNER.note),
    stepsTitle: { en: "Five steps to your first booking", ur: "پانچ قدم", ro: "Paanch qadam" },
  },
  benefits: Object.fromEntries(BENEFIT_KEYS.map((k, i) => [k, trio(PARTNER.benefits[i])])) as Record<(typeof BENEFIT_KEYS)[number], Trio>,
  steps: Object.fromEntries(STEP_KEYS.map((k, i) => [k, trio(PARTNER.steps[i])])) as Record<(typeof STEP_KEYS)[number], Trio>,
  apply: {
    about: { en: "About you", ur: "آپ کے بارے میں", ro: "Aap ke baare mein" },
    yourSkills: { en: "Your skills", ur: "آپ کا ہنر", ro: "Aapka hunar" },
    yourTime: { en: "Your time", ur: "آپ کا وقت", ro: "Aapka waqt" },
    step: { en: "Step {{n}} of 3", ur: "3 میں سے مرحلہ {{n}}", ro: "Step {{n}} of 3" },
    other: { en: "Other", ur: "کوئی اور", ro: "Koi aur" },
    name: trio(APPLY_LABELS.name),
    phone: trio(APPLY_LABELS.phone),
    area: trio(APPLY_LABELS.area),
    skills: trio(APPLY_LABELS.skills),
    experience: trio(APPLY_LABELS.experience),
    availability: trio(APPLY_LABELS.availability),
    transport: trio(APPLY_LABELS.transport),
    portfolio: trio(APPLY_LABELS.portfolio),
    next: trio(APPLY_LABELS.next),
    back: trio(APPLY_LABELS.back),
    submit: trio(APPLY_LABELS.submit),
    privacy: trio(APPLY_LABELS.privacy),
  },
  errors: {
    name: { en: "Please enter your name", ur: "براہ کرم اپنا نام لکھیں", ro: "Apna naam likhein" },
    phone: { en: "Enter a mobile number like 0300 1234567", ur: "موبائل نمبر لکھیں، جیسے 03001234567", ro: "Mobile number likhein, jaise 0300 1234567" },
    area: { en: "Choose your area", ur: "اپنا علاقہ چنیں", ro: "Apna ilaqa chunein" },
    skills: { en: "Pick at least one skill", ur: "کم از کم ایک کام چنیں", ro: "Kam az kam ek skill chunein" },
    experience: { en: "Choose your experience", ur: "اپنا تجربہ چنیں", ro: "Apna tajurba chunein" },
    availability: { en: "Pick at least one day", ur: "کم از کم ایک دن چنیں", ro: "Kam az kam ek din chunein" },
    transport: { en: "Choose one", ur: "ایک چنیں", ro: "Ek chunein" },
  },
  skills: byId(SKILLS, SKILL_KEY),
  experienceOptions: byId(EXPERIENCE, EXPERIENCE_KEY),
  days: byId(DAYS, same(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const)),
  transportOptions: byId(TRANSPORT, same(["own", "need"] as const)),
  thanks: {
    title: { en: "Shukriya! We've got it.", ur: "شکریہ! آپ کی درخواست مل گئی۔", ro: "Shukriya! Aapki application mil gayi." },
    body: { en: "Our team will call or WhatsApp you soon to set up your interview.", ur: "ہماری ٹیم جلد آپ کو کال یا واٹس ایپ کرے گی اور انٹرویو کا وقت طے کرے گی۔", ro: "Humari team jald aapko call ya WhatsApp karegi aur interview ka waqt tay karegi." },
    now: {
      en: "Want to go faster? Take your first interview right now, on your phone. It takes about 10 minutes, in English, Urdu or Roman Urdu. A person at Mjazo reviews every interview.",
      ur: "جلدی آگے بڑھنا چاہتی ہیں؟ ابھی اپنے فون پر پہلا انٹرویو دیں۔ تقریباً ۱۰ منٹ، اردو، انگریزی یا رومن اردو میں۔ مجازو کی ٹیم ہر انٹرویو خود دیکھتی ہے۔",
      ro: "Jaldi aage barhna chahti hain? Abhi apne phone par pehla interview dein. Taqreeban 10 minute, Urdu, English ya Roman Urdu mein. Mjazo ki team har interview khud dekhti hai.",
    },
    start: { en: "Start my interview", ur: "انٹرویو شروع کریں", ro: "Interview shuru karein" },
    back: { en: "Back to Mjazo", ur: "واپس جائیں", ro: "Wapas jayein" },
  },
  titles: {
    apply: { en: "Apply to join Mjazo as a beautician", ur: "مجازو میں بیوٹیشن کے طور پر شامل ہونے کی درخواست", ro: "Mjazo mein beautician ke taur par apply karein" },
    applyDescription: { en: "Apply in 2 minutes, in English or Urdu. We never ask for your CNIC online.", ur: "2 منٹ میں درخواست دیں، اردو یا انگریزی میں۔ ہم آن لائن شناختی کارڈ کبھی نہیں مانگتے۔", ro: "2 minute mein apply karein, Urdu ya English mein. Hum online CNIC kabhi nahi maangte." },
    thanks: { en: "Application received", ur: "درخواست موصول ہو گئی", ro: "Application mil gayi" },
    interview: { en: "Your Mjazo interview", ur: "آپ کا مجازو انٹرویو", ro: "Aapka Mjazo interview" },
  },
  interview: {
    title: { en: "Your Mjazo interview", ur: "آپ کا مجازو انٹرویو", ro: "Aapka Mjazo interview" },
    note: { en: "AI interviewer · about 10 minutes · a person reviews every answer", ur: "اے آئی انٹرویو · تقریباً ۱۰ منٹ · ہر جواب ہماری ٹیم خود دیکھتی ہے", ro: "AI interviewer · taqreeban 10 minute · har jawab humari team khud dekhti hai" },
    type: { en: "Type or tap the mic to speak…", ur: "لکھیں یا مائیک دبا کر بولیں…", ro: "Likhein ya mic daba kar bolein…" },
    pick: { en: "Pick a time for your practical test", ur: "پریکٹیکل ٹیسٹ کا وقت چنیں", ro: "Practical test ka waqt chunein" },
    pickSub: { en: "We'll WhatsApp you the address and what to bring.", ur: "ہم واٹس ایپ پر پتہ اور ساتھ لانے والی چیزیں بتا دیں گے۔", ro: "Hum WhatsApp par address aur saath lane wali cheezein bata denge." },
    booked: { en: "Practical test booked", ur: "پریکٹیکل ٹیسٹ بک ہو گیا", ro: "Practical test book ho gaya" },
    bookedSub: { en: "Our team will WhatsApp you to confirm. Shukriya!", ur: "ہماری ٹیم واٹس ایپ پر تصدیق کرے گی۔ شکریہ!", ro: "Humari team WhatsApp par confirm karegi. Shukriya!" },
    offline: { en: "The online interview isn't available right now. Our team will call you for your interview instead.", ur: "آن لائن انٹرویو ابھی دستیاب نہیں۔ ہماری ٹیم آپ کو کال کر کے انٹرویو کرے گی۔", ro: "Online interview abhi available nahi. Humari team aapko call karke interview karegi." },
    home: { en: "Back to Mjazo", ur: "واپس جائیں", ro: "Wapas jayein" },
    error: { en: "Something went wrong", ur: "کچھ غلط ہو گیا", ro: "Kuch ghalat ho gaya" },
    homeLink: { en: "Mjazo home", ur: "مجازو ہوم", ro: "Mjazo home" },
    speak: { en: "Speak", ur: "بولیں", ro: "Bolein" },
    send: { en: "Send", ur: "بھیجیں", ro: "Bhejein" },
  },
}

export type PartnerText = typeof PARTNER_TEXT
