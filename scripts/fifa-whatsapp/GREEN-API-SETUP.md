# איך מחברים שליחה לקבוצות (גם מהענן)

Baileys על המחשב שלך **לא** מאפשר לסוכן בענן לשלוח הודעות.  
כדי שאפשר יהיה לשלוח מכאן / מ-Vercel — משתמשים ב־**Green API**.

## 1) נרשמים ל-Green API

1. היכנסו ל-[green-api.com](https://green-api.com/) וצרו חשבון
2. צרו Instance
3. סרקו QR עם אותו וואטסאפ שמחובר לקבוצות
4. העתיקו:
   - `idInstance` → `GREEN_API_INSTANCE`
   - `apiTokenInstance` → `GREEN_API_TOKEN`

## 2) מוצאים את ה-Chat ID של כל קבוצה

בממשק Green API → **Get groups** / `getChats`  
או שלחו הודעה לקבוצה ואז קראו `lastIncomingMessages`.

צריך שני מזהים בסגנון:

```text
120363xxxxxxxx@g.us
```

- LIVE → `FIFA_WHATSAPP_MAIN_CHAT_ID`
- VIP → `FIFA_WHATSAPP_VIP_CHAT_ID`

## 3) שמים ב-Vercel (Settings → Environment Variables)

```bash
GREEN_API_INSTANCE=...
GREEN_API_TOKEN=...
FIFA_WHATSAPP_MAIN_CHAT_ID=120363...@g.us
FIFA_WHATSAPP_VIP_CHAT_ID=120363...@g.us
FIFA_BOT_SECRET=סוד-ארוך-ששמור-אצלך
NEXT_PUBLIC_SITE_URL=https://my-next-app-5jte.vercel.app
```

לאחר מכן **Redeploy**.

## 4) בדיקה — שליחה לשתי הקבוצות

```bash
curl -X POST "https://YOUR-SITE.vercel.app/api/fifa-bot/announce" \
  -H "Authorization: Bearer FIFA_BOT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"*✅ בדיקה*\nהבוט מחובר לשתי הקבוצות","channels":["main","vip"]}'
```

אחרי שזה עובד — תגיד לי כאן "תשלח בדיקה" ואני אוכל לשלוח דרך ה-API.

## 5) תקצירי וידאו אחרי כל משחק

אחרי סיום משחק הבוט מחפש תקציר FOX (catch-up / 4 דק׳), דוחס עם `ffmpeg` (כשיש),
ושולח ל־LIVE + VIP דרך `sendFileByUpload`.

- כבוי: `FIFA_BOT_SEND_HIGHLIGHTS=0`
- שליחה ידנית: `npm run fifa-bot:highlight` עם `FIFA_HL_HOME_CODE` / `FIFA_HL_AWAY_CODE`
- ב־Vercel בלי ffmpeg יישלח קישור צפייה; עם poller/hotpath מקומי יישלח הווידאו עצמו
- נשלח **רק** תקציר FOX ~4 דק׳ (`4MIN_*_HL_*`), לא catch-up קצר
- מניעת כפילויות: fingerprint משותף + כש־hotpath רץ (lock) ה־cron/poller לא שולח גם
- אם רצים hotpath מקומי וגם Vercel cron עם Green — הגדירו ב־Vercel `FIFA_BOT_WHATSAPP_NOTIFY=0`
