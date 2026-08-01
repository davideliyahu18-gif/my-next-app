# גשר טלגרם → וואטסאפ

מעביר הודעות חדשות מערוץ/ערוצי טלגרם **ציבוריים** שאתה עוקב אחריהם לקבוצת וואטסאפ.

## איך זה עובד

1. **סריקה (ברירת מחדל)** — קורא את תצוגת הערוץ הציבורי (`t.me/s/username`) ב-cron
2. **שליחה** — Green API לקבוצת הוואטסאפ שלך
3. **ללא הצפה** — הריצה הראשונה רק מסמנת היסטוריה כ"נקרא"; רק הודעות חדשות אחר כך נשלחות

## הגדרה מהירה

### 1) ערוצי טלגרם

ערוץ חייב להיות **ציבורי** (עם `@username`).

ב-Vercel → Environment Variables:

```bash
TG_WA_CHANNELS=newsil5:מודיעין גלוי,shigurimisrael:שיגורים
```

אפשר ערוץ אחד בלבד:

```bash
TG_WA_CHANNELS=my_channel
```

### 2) Green API (וואטסאפ)

1. היכנסו ל-[green-api.com](https://green-api.com/) וצרו Instance
2. סרקו QR עם הוואטסאפ שמחובר לקבוצה
3. העתיקו:

```bash
GREEN_API_INSTANCE=...
GREEN_API_TOKEN=...
TG_WA_WHATSAPP_CHAT_ID=120363...@g.us
```

את ה-Chat ID מוצאים ב-Green API → Get groups / `getChats`, או אחרי הודעה בקבוצה ב-`lastIncomingMessages`.

### 3) סוד ל-API

```bash
TG_WA_BRIDGE_SECRET=סוד-ארוך-ששמור-אצלך
# או להשתמש ב-CRON_SECRET / FEED_API_SECRET הקיימים
```

Redeploy אחרי שמירת המשתנים.

## בדיקות

סטטוס:

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://YOUR-SITE.vercel.app/api/tg-wa-bridge/status"
```

הודעת בדיקה לקבוצה:

```bash
curl -X POST -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"*✅ בדיקה* מהגשר"}' \
  "https://YOUR-SITE.vercel.app/api/tg-wa-bridge/test"
```

סריקה יבשה (בלי לשלוח):

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://YOUR-SITE.vercel.app/api/cron/tg-wa-bridge?dry=1"
```

סריקה אמיתית:

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://YOUR-SITE.vercel.app/api/cron/tg-wa-bridge"
```

## תדירות (חשוב)

ב-Vercel Hobby יש cron יומי אחד לנתיב. להעברה כמעט בזמן אמת — הגדירו ping חיצוני (UptimeRobot / cron-job.org) כל 1–2 דקות:

`GET https://YOUR-SITE.vercel.app/api/cron/tg-wa-bridge`  
Header: `Authorization: Bearer YOUR_SECRET`

ב-Pro אפשר לשנות ב-`vercel.json` ל-`*/2 * * * *`.

## מצב מיידי (אופציונלי)

אם אתה **אדמין** בערוץ:

1. צור בוט ב-BotFather (מומלץ בוט נפרד מבוט החמ״ל)
2. הוסף אותו כאדמין לערוץ
3. הגדר:

```bash
TG_WA_TELEGRAM_BOT_TOKEN=...
TG_WA_WEBHOOK_SECRET=...
TG_WA_CHANNELS=your_channel
```

4. רשום webhook:

```bash
curl -X POST -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://YOUR-SITE.vercel.app/api/tg-wa-bridge/webhook"}' \
  "https://YOUR-SITE.vercel.app/api/tg-wa-bridge/setup"
```

> אל תשתמש באותו webhook URL של בוט החמ״ל (`/api/rockets/telegram-webhook`) — זה דורס זה את זה.

## מגבלות

- ערוצים **פרטיים** בלי `@username` לא נסרקים בתצוגה הציבורית
- מדיה: תמונות נשלחות כשמתאפשר (`sendFileByUrl`); וידאו/קבצים מורכבים — לפחות קישור להודעה בטלגרם
- צריך Redis (Upstash) בפרודקשן כדי שלא יישלחו כפילויות אחרי cold start
