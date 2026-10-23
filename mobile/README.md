# Mjazo phone apps

Two Expo (React Native) apps on one shared package:

| App | Folder | Who | What |
|---|---|---|---|
| **Mjazo** | `apps/customer` | Customers | Browse the catalogue, book (address, real free time windows, promo code, credit), follow bookings live, move or cancel within the free-change time, rate, book a pro again, saved addresses, the WhatsApp messages switch, sign-in by phone number (a code) or email. The AI tools: Ask Mjazo (the Concierge chat that can book), Ghar Scan (with the brief sent to the pro), Home Pulse, and Glam Mirror and the Shaadi Orchestrator on the website. English and Urdu. |
| **Mjazo Pro** | `apps/pro` | Pros | Sign in with phone + PIN (or an emailed link), today's visits and the coming days, offers to accept or decline, On my way → check in → I'm safe → finish with the payment (a screenshot for digital payments), SOS, earnings and payouts from the ledger, ratings, weekly windows and days off, live location while on the way, and the AI Copilot (today's brief read aloud, questions with a photo). English, Urdu and Roman Urdu. |

`packages/shared` holds what both use: the API client, sign-in, storage, the design (brand colours, cards, buttons), languages, formatting, location and push.

Everything goes through the website's API (`/api/v1/*`, plus `/api/rate`), so the apps always show what the website and mission control show. The apps hold no secrets: Supabase's public address and key come from `/api/v1/config`.

## Try it on your phone (Expo Go)

1. On your Android phone, install **Expo Go** from the Play Store.
2. On the laptop, in a terminal (the phone and laptop on the same Wi-Fi):

   ```
   cd F:\mjazo\website\mobile
   npm install
   npm run customer
   ```

   (`npm run pro` for Mjazo Pro.) A QR code appears. In Expo Go, tap **Scan QR code**. The first load takes a minute.
3. If the phone can't reach the laptop (another network, or Windows Firewall), use `npx expo start --tunnel` inside `apps/customer` or `apps/pro` instead (it offers to install the tunnel the first time).

The apps talk to the live site, **https://mjazo.vercel.app**. To try them against the laptop's dev server instead, start it, then e.g. `set EXPO_PUBLIC_API_URL=http://192.168.1.20:3000&& npm run customer` with the laptop's Wi-Fi address. Against a test server the customer app also offers a local test sign-in.

What works in Expo Go and what needs the installed app:

| | Expo Go | Installed app (EAS build) |
|---|---|---|
| Browse, book, track, rate, account | ✓ | ✓ |
| Pro: schedule, offers, visits, payments, SOS, earnings | ✓ | ✓ |
| Location (Use my location, On my way, SOS) | ✓ | ✓ |
| Phone-number sign-in (a code) | ✓ | ✓ |
| Email sign-in links | ✓ (see below) | ✓ |
| **Push notifications** (offers to pros, booking updates to customers) | ✗ (Expo Go can't receive pushes) | ✓ |

## Sign-in

- **Pros:** phone number + the PIN ops set in mission control → Pros. Email sign-in works for a pro whose email is saved on her profile.
- **Customers:** their phone number and a 6-digit code on WhatsApp or by SMS, once the website has `WHATSAPP_OTP_TEMPLATE` or the `TWILIO_*` settings (see `.env.example`; against a test server the code shows on screen). It works in Expo Go too, and Android offers the code from the SMS. Or an emailed link (Supabase). In Supabase → Authentication → URL Configuration, add these to **Redirect URLs**: `mjazo://**` and `mjazopro://**` (the installed apps), and `exp://**` (Expo Go). Supabase needs an SMTP sender for real use (its own email sends only a few an hour).

## Store builds (EAS)

These need **your** Expo account (free) and, to publish, a Google Play developer account (USD 25, once).

```
npm install -g eas-cli
eas login
cd F:\mjazo\website\mobile\apps\customer
eas init          (links the app to your Expo account; writes its project id into app.json)
eas build -p android --profile preview      (an APK you can install directly)
eas build -p android --profile production   (an AAB for the Play Store)
```

The same in `apps/pro`. After `eas init`, push notifications work in the installed apps: they register themselves with the API, and the automation sends offers and booking updates as pushes. `EXPO_ACCESS_TOKEN` on Vercel is only needed if you switch on Expo's enhanced push security.

App ids: `pk.mjazo.app` (Mjazo) and `pk.mjazo.pro` (Mjazo Pro). Icons and splash screens are in each app's `assets/`, made from the brand kit's house mark.

## Developing

- `npm run typecheck`: TypeScript for the shared package and both apps.
- `node scripts/web-dev.mjs customer` (or `pro`): an app in the browser against the laptop's dev server (localhost:3000), at http://localhost:8082. Used for quick checks; the real thing is the phone.
- Texts: `apps/customer/src/strings.ts` and `apps/pro/src/strings.ts` (Urdu next to English). Most of the Urdu is the website's reviewed copy.
- Each app's `metro.config.js` only looks for packages in this folder, never in the website's `node_modules`.
