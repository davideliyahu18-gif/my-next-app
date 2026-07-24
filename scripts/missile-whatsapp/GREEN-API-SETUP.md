# חיבור קבוצת WhatsApp מוכנה לבוט השיגורים

יש לך קבוצה מוכנה — צריך רק לחבר אליה שליחה (טקסט + סיכת מיקום).

## אפשרות מומלצת: Green API (עובד גם מ־Vercel / מהענן)

### 1) חשבון Green API
1. היכנסו ל־[green-api.com](https://green-api.com/) וצרו Instance
2. סרקו QR עם **אותו וואטסאפ** שחבר בקבוצה
3. העתיקו:
   - `idInstance` → `GREEN_API_INSTANCE`
   - `apiTokenInstance` → `GREEN_API_TOKEN`

### 2) מציאת ה־Chat ID של הקבוצה

אחרי שיש Instance מחובר, הריצו (מקומית או מול האתר):

```bash
curl "https://YOUR_SITE/api/missile-alerts/groups" \
  -H "Authorization: Bearer $CRON_SECRET"
```

או ישירות מול Green API:

```bash
curl "https://api.green-api.com/waInstance$GREEN_API_INSTANCE/getChats/$GREEN_API_TOKEN"
```

חפשו את שם הקבוצה שלכם. המזהה נראה כך:

```text
120363xxxxxxxx@g.us
```

שימו אותו ב־:

```bash
MISSILE_WHATSAPP_CHAT_ID=120363xxxxxxxx@g.us
```

### 3) משתני סביבה ב־Vercel

```bash
GREEN_API_INSTANCE=...
GREEN_API_TOKEN=...
MISSILE_WHATSAPP_CHAT_ID=120363...@g.us
CRON_SECRET=סוד-ארוך
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
MISSILE_ALERT_REQUIRE_KUWAIT_MENTION=true
```

לאחר מכן **Redeploy**.

### 4) שליחת בדיקה (טקסט + מיקום לכווית)

```bash
curl -X POST "https://YOUR_SITE/api/missile-alerts/test" \
  -H "Authorization: Bearer $CRON_SECRET"
```

אמורה להגיע לקבוצה הודעה + סיכת מיקום של כווית סיטי.

---

## אפשרות ב׳: Baileys במחשב שלכם (בלי Green API)

```bash
cd scripts/missile-whatsapp
npm install
```

ב־`.env.local` בשורש הפרויקט:

```bash
MISSILE_WHATSAPP_GROUP_NAME=השם המדויק של הקבוצה שלכם
MISSILE_ALERT_SITE_URL=http://127.0.0.1:3000
CRON_SECRET=...
```

```bash
npm start          # סרקו QR
npm run test-send  # שולח הדגמה עם מיקום
```

הסקריפט מוצא את הקבוצה לפי השם ושולח `location` native.

---

## קבוצה מוגדרת

שם הקבוצה: **🛡️ מרכז התרעות אזורי**

ב־Baileys זה כבר ברירת המחדל של `MISSILE_WHATSAPP_GROUP_NAME`.  
ב־Green API — אחרי חיבור Instance, חפשו את השם הזה ברשימת הקבוצות ושימו את ה־`@g.us` ב־`MISSILE_WHATSAPP_CHAT_ID`.

## מה עוד לשלוח כדי להשלים חיבור

אם תדביקו כאן:
1. `GREEN_API_INSTANCE`
2. `GREEN_API_TOKEN`

אוכל לאתר את ה־Chat ID של «🛡️ מרכז התרעות אזורי» ולבדוק שליחה עם מיקום.
