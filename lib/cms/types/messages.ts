import { register } from "../registry"
import { stringFields } from "./strings"

// The messages Mjazo sends by itself (stage 5 automation): to customers on WhatsApp or by email, and
// to pros. Hand-written Urdu goes to customers whose account is set to Urdu. On WhatsApp, Meta only
// lets a business start a conversation with an approved template: mission control → Automations
// names each one and lists its parameters in order; this text is the email and the log copy.
// Keep every {{token}}: the sender fills them in.

export const MESSAGES = {
  bookingConfirmed: {
    subject: "Your Mjazo booking {{id}} is confirmed",
    text: "Assalam o Alaikum {{name}}! Your Mjazo booking is confirmed: {{services}} on {{date}}, {{window}}. Booking number {{id}}. You pay after the visit. To see or change it: {{link}}",
  },
  reminder: {
    subject: "Tomorrow: your Mjazo visit",
    text: "Hi {{name}}, a reminder that your Mjazo visit is tomorrow, {{date}}, {{window}}: {{services}}. Need to change it? {{link}}",
  },
  onTheWay: {
    subject: "{{pro}} is on the way",
    text: "{{pro}} from Mjazo is on the way to you for {{services}}, expected around {{arrive}}. Booking {{id}}.",
  },
  rateVisit: {
    subject: "How was your Mjazo visit?",
    text: "Thank you for choosing Mjazo, {{name}}! How was your visit with {{pro}}? Rate it in ten seconds: {{link}}",
  },
  pulseNudge: {
    subject: "Home Pulse: {{title}} is due",
    text: "Hi {{name}}, your Home Pulse plan says {{title}} is due on {{date}}. Book it in two minutes: {{link}} Reply STOP to stop these reminders.",
  },
  winBack60: {
    subject: "It's been a while",
    text: "Hi {{name}}, it's been a while since your last Mjazo visit. Book your next one in two minutes: {{link}} Reply STOP to stop these messages.",
  },
  winBack90: {
    subject: "We miss you at Mjazo",
    text: "Hi {{name}}, we miss you at Mjazo! Your favourite services are a tap away: {{link}} Reply STOP to stop these messages.",
  },
  proOffer: {
    subject: "New visit offer: {{services}}",
    text: "New Mjazo visit for you: {{services}} in {{area}}, {{date}}, {{window}}. You earn {{earn}}. Answer by {{until}} in the Mjazo Pro app: {{link}}",
  },
  referralReward: {
    subject: "{{amount}} credit from Mjazo",
    text: "Shukriya {{name}}! {{friend}} had their first Mjazo visit with your code, so {{amount}} credit is in your account for your next booking: {{link}}",
  },
  plusWelcome: {
    subject: "Welcome to Mjazo Plus",
    text: "Welcome to Mjazo Plus, {{name}}! Until {{until}} you get {{pct}}% off every booking, taken off by itself. Book: {{link}}",
  },
  packWelcome: {
    subject: "Your Mjazo pack is ready",
    text: "Your {{pack}} pack is ready, {{name}}: {{visits}} visits to use by {{until}}. Book the first one in two taps: {{link}}",
  },
  packDue: {
    subject: "Time for your next {{pack}} visit",
    text: "Hi {{name}}, your next {{pack}} visit is due. You have {{left}} left; book it in two taps: {{link}} Reply STOP to stop these reminders.",
  },
  receipt: {
    subject: "Your Mjazo receipt {{no}}",
    text: "Thank you, {{name}}! Your receipt {{no}} for {{amount}} is here: {{link}}",
  },
}

export type MessageTexts = typeof MESSAGES
export type MessageKey = keyof MessageTexts

export const MESSAGES_UR: MessageTexts = {
  bookingConfirmed: {
    subject: "آپ کی مجازو بکنگ {{id}} کنفرم ہے",
    text: "السلام علیکم {{name}}! آپ کی مجازو بکنگ کنفرم ہے: {{services}}، {{date}}، {{window}}۔ بکنگ نمبر {{id}}۔ ادائیگی وزٹ کے بعد۔ دیکھنے یا بدلنے کے لیے: {{link}}",
  },
  reminder: {
    subject: "کل: آپ کا مجازو وزٹ",
    text: "{{name}}، یاد دہانی: آپ کا مجازو وزٹ کل ہے، {{date}}، {{window}}: {{services}}۔ بدلنا ہو تو: {{link}}",
  },
  onTheWay: {
    subject: "{{pro}} راستے میں ہیں",
    text: "مجازو سے {{pro}} {{services}} کے لیے آپ کی طرف آ رہی ہیں، تقریباً {{arrive}} تک پہنچیں گی۔ بکنگ {{id}}۔",
  },
  rateVisit: {
    subject: "آپ کا مجازو وزٹ کیسا رہا؟",
    text: "مجازو چننے کا شکریہ، {{name}}! {{pro}} کے ساتھ آپ کا وزٹ کیسا رہا؟ دس سیکنڈ میں ریٹ کریں: {{link}}",
  },
  pulseNudge: {
    subject: "ہوم پلس: {{title}} کا وقت",
    text: "{{name}}، آپ کے ہوم پلس پلان کے مطابق {{title}} کا وقت {{date}} کو ہے۔ دو منٹ میں بک کریں: {{link}} یہ یاد دہانیاں بند کرنے کے لیے STOP لکھ کر بھیجیں۔",
  },
  winBack60: {
    subject: "کافی دن ہو گئے",
    text: "{{name}}، آپ کے پچھلے مجازو وزٹ کو کافی دن ہو گئے۔ اگلا وزٹ دو منٹ میں بک کریں: {{link}} یہ پیغامات بند کرنے کے لیے STOP لکھ کر بھیجیں۔",
  },
  winBack90: {
    subject: "مجازو آپ کو یاد کرتا ہے",
    text: "{{name}}، مجازو آپ کو یاد کرتا ہے! آپ کی پسندیدہ سروسز بس ایک ٹیپ دور ہیں: {{link}} یہ پیغامات بند کرنے کے لیے STOP لکھ کر بھیجیں۔",
  },
  proOffer: {
    subject: "نئے وزٹ کی آفر: {{services}}",
    text: "آپ کے لیے نیا مجازو وزٹ: {{services}}، {{area}}، {{date}}، {{window}}۔ آپ کی کمائی {{earn}}۔ مجازو پرو ایپ میں {{until}} تک جواب دیں: {{link}}",
  },
  referralReward: {
    subject: "مجازو کی طرف سے {{amount}} کریڈٹ",
    text: "شکریہ {{name}}! {{friend}} نے آپ کے کوڈ سے مجازو کا پہلا وزٹ کیا، اس لیے آپ کے اکاؤنٹ میں اگلی بکنگ کے لیے {{amount}} کریڈٹ آ گیا ہے: {{link}}",
  },
  plusWelcome: {
    subject: "مجازو پلس میں خوش آمدید",
    text: "مجازو پلس میں خوش آمدید، {{name}}! {{until}} تک ہر بکنگ پر {{pct}}% رعایت خود بخود لگے گی۔ بکنگ: {{link}}",
  },
  packWelcome: {
    subject: "آپ کا مجازو پیک تیار ہے",
    text: "{{name}}، آپ کا {{pack}} پیک تیار ہے: {{until}} تک {{visits}} وزٹس۔ پہلا وزٹ دو ٹیپ میں بک کریں: {{link}}",
  },
  packDue: {
    subject: "{{pack}} کے اگلے وزٹ کا وقت",
    text: "{{name}}، آپ کے {{pack}} پیک کا اگلا وزٹ آ گیا ہے۔ ابھی {{left}} وزٹس باقی ہیں؛ دو ٹیپ میں بک کریں: {{link}} یہ یاد دہانیاں بند کرنے کے لیے STOP لکھ کر بھیجیں۔",
  },
  receipt: {
    subject: "آپ کی مجازو رسید {{no}}",
    text: "شکریہ {{name}}! {{amount}} کی آپ کی رسید {{no}} یہاں ہے: {{link}}",
  },
}

const GROUPS: Record<MessageKey, string> = {
  bookingConfirmed: "Booking confirmed",
  reminder: "Reminder, the day before",
  onTheWay: "Your pro is on the way",
  rateVisit: "Rate your visit",
  pulseNudge: "Home Pulse reminder (opt-in)",
  winBack60: "Win-back after 60 days (opt-in)",
  winBack90: "Win-back after 90 days (opt-in)",
  proOffer: "A visit offered to a pro",
  referralReward: "Referral credit (to the customer who referred a friend)",
  plusWelcome: "Welcome to Mjazo Plus",
  packWelcome: "Your pack is ready",
  packDue: "Time for your next pack visit",
  receipt: "Your receipt (after each visit)",
}

register<MessageTexts, MessageTexts>({
  type: "messages",
  label: "Customer messages",
  group: "Settings",
  kind: "singleton",
  icon: "MessageCircle",
  description: "The messages Mjazo sends by itself: booking confirmed, the day-before reminder, \"your pro is on the way\", \"rate your visit\", the opt-in reminders and win-backs, visit offers to pros, referral credit, the Plus welcome, the pack messages and receipts. Each one can be switched on or off in mission control → Automations. Keep the {{tokens}}.",
  fields: stringFields(MESSAGES, GROUPS),
  defaults: () => MESSAGES,
  translations: { ur: () => MESSAGES_UR },
  path: () => "/account",
})
