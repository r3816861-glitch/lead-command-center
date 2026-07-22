# Lead Command Center — Mobile (Expo)

## Bolt.new mein kaise chalayein
1. Bolt.new pe naya **Expo** project banao (ya blank Expo template lo)
2. Is folder ki saari files usme paste/upload kar do — same folder structure rakhna (`app/`, `lib/` alag folders hain)
3. Agar Bolt.new pehle se `package.json` deta hai, usme se yahi dependencies match/add kar do (neeche list hai)
4. Run karo — QR code milega, **Expo Go** app se scan karke phone pe khul jayega
5. App seedha **index screen** pe load hoga — koi extra route/navigation nahi hai, isliye routing error ka chance nahi hai

## Kya badla hai web version se (important, padhna zaroor)

### 1. Storage — ab AsyncStorage
Web version Claude ke andar hi kaam karne wala `window.storage` use karta tha. Ye standalone Expo app ke liye kaam nahi karta, isliye ab **`@react-native-async-storage/async-storage`** use ho raha hai — data seedha phone ke andar save hota hai, bilkul reliable, internet ke bina bhi chalega. `lib/storage.js` mein retry logic bhi hai agar pehli baar save fail ho.

### 2. AI features — optional, apni API key chahiye
`window.fetch('https://api.anthropic.com/...')` sirf Claude ke artifact sandbox ke andar bina key ke kaam karta hai. Standalone app mein isse chalane ke liye tumhe apni **Anthropic API key** chahiye hogi (Settings screen mein daal sakte ho — abhi ke liye field ban chuka hai, connect karna baaki hai).

**Bina API key ke bhi ye sab poora kaam karta hai:**
- Quick Add (deterministic Hinglish parser — "Req-", "M.V-", "kal 4 baje" sab samajhta hai, koi AI nahi chahiye)
- Objection Destroyer (8 ready rebuttals, instant)
- Buying Intent Score (rule-based calculation)
- Pipeline / List / Insights views
- Call, WhatsApp, SMS 1-tap buttons
- "Aaj Ki Kamai" tracker
- CSV export (clipboard copy)

**API key chahiye hoga sirf:** Smart Hook Generator aur AI Coach (abhi placeholder hain, `refineWithAI` function mein wire karna baaki hai — agar chahiye to bata dena, agla step bana dunga).

### 3. Voice Notes — is version mein nahi hai
Expo Go (QR-scan wala simple setup) mein speech-to-text ke liye native module chahiye hota hai jo custom dev build maangta hai. Isliye abhi ye feature nahi hai. Baaki sab kaam karta hai.

## Dependencies (agar Bolt.new manually add karwaye)
```
expo, expo-router, expo-status-bar, expo-clipboard, expo-constants, expo-linking,
react-native-safe-area-context, react-native-screens,
@react-native-async-storage/async-storage, @expo/vector-icons, nativewind, tailwindcss
```

## Files
- `app/_layout.jsx` — root layout (single Stack, index only)
- `app/index.jsx` — poori app yahi hai (Pipeline/List/Insights tabs + saare modals)
- `lib/constants.js` — status, products, banks, objections list
- `lib/utils.js` — parser, scoring, formatting functions
- `lib/storage.js` — AsyncStorage read/write with retry
