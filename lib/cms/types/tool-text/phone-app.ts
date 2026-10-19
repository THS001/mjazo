// Text inside the tappable mini app in the home hero's phone, with shipped Urdu. Most of its words
// (cart, search, waitlist) come from Buttons & labels; these are the phone's own.
// Edited in Pages → Home page → Hero phone app.

export const PHONE_TEXT = {
  device: { demo: "Interactive Mjazo app demo: tap around", tryIt: "Tap to try the Mjazo app", tap: "Tap to try the app", done: "Done" },
  tabs: { home: "Home", search: "Search", cart: "Cart", profile: "Profile", back: "Back" },
  home: {
    setArea: "Set your area",
    today: "What do you need today?",
    search: "Search waxing, facial, AC…",
    seeAll: "See all",
    addItem: "Add {{name}}",
    bundleBadge: "Hero bundle",
    bundleName: "The Full Glow",
    bundleSub: "Full body wax + brightening facial",
    explore: "Explore",
  },
  browse: {
    acrossKarachi: "Available across Karachi",
    soon: "Soon",
    waitlist: "Want {{category}} in your area? Join the waitlist: we open where it's loudest.",
    includes: "Every visit includes",
    comingSoon: "Coming soon. Get a WhatsApp the day it opens in your area.",
    addPrice: "Add to cart · {{price}}",
    added: "{{name}} added",
  },
  cart: {
    emptySub: "Add a service and it shows up here, and on the real site too.",
    checkout: "Checkout · pay after service",
  },
  profile: {
    comeTo: "We come to {{count}} neighbourhoods across Karachi.",
    soon: "soon",
    help: "Help & support",
  },
}

export type PhoneText = typeof PHONE_TEXT

export const PHONE_TEXT_UR: PhoneText = {
  device: { demo: "مجازو ایپ کا انٹرایکٹو ڈیمو: ٹیپ کر کے دیکھیں", tryIt: "مجازو ایپ آزمانے کے لیے ٹیپ کریں", tap: "ایپ آزمانے کے لیے ٹیپ کریں", done: "ہو گیا" },
  tabs: { home: "ہوم", search: "تلاش", cart: "کارٹ", profile: "پروفائل", back: "واپس" },
  home: {
    setArea: "اپنا علاقہ چنیں",
    today: "آج آپ کو کیا چاہیے؟",
    search: "ویکسنگ، فیشل، اے سی تلاش کریں…",
    seeAll: "سب دیکھیں",
    addItem: "{{name}} شامل کریں",
    bundleBadge: "خاص بنڈل",
    bundleName: "دی فل گلو",
    bundleSub: "فل باڈی ویکس + برائٹننگ فیشل",
    explore: "دیکھیں",
  },
  browse: {
    acrossKarachi: "پورے کراچی میں دستیاب",
    soon: "جلد",
    waitlist: "اپنے علاقے میں {{category}} چاہیے؟ ویٹ لسٹ میں شامل ہوں: جہاں مانگ زیادہ ہو، ہم وہیں پہلے شروع کرتے ہیں۔",
    includes: "ہر وزٹ میں شامل",
    comingSoon: "جلد آ رہا ہے۔ آپ کے علاقے میں شروع ہوتے ہی واٹس ایپ پائیں۔",
    addPrice: "کارٹ میں شامل کریں · {{price}}",
    added: "{{name}} شامل ہو گیا",
  },
  cart: {
    emptySub: "کوئی سروس شامل کریں، وہ یہاں اور اصل سائٹ پر بھی نظر آئے گی۔",
    checkout: "چیک آؤٹ · سروس کے بعد ادائیگی",
  },
  profile: {
    comeTo: "ہم کراچی کے {{count}} علاقوں میں آتے ہیں۔",
    soon: "جلد",
    help: "مدد اور سپورٹ",
  },
}
