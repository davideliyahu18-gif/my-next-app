# גשר טלגרם → וואטסאפ

מעביר הודעות חדשות מערוץ טלגרם לקבוצת וואטסאפ.

## החיבור שלך

| מקור | יעד |
|------|-----|
| טלגרם [`@Mivzakeybitachon2225`](https://t.me/Mivzakeybitachon2225) (מבזקי ביטחון 24/7) | וואטסאפ **דיווחים מבצעי איראן 🇮🇷** |

## איך זה עובד

1. סורק את תצוגת הערוץ הציבורי
2. שולח הודעות חדשות לקבוצה דרך Green API
3. הריצה הראשונה רק מסמנת היסטוריה (בלי הצפה)

## הגדרה ב-Vercel

```bash
# כבר מוגדר כברירת מחדל בקוד — אפשר גם לכתוב במפורש:
TG_WA_CHANNELS=Mivzakeybitachon2225:מבזקי ביטחון 24/7
TG_WA_WHATSAPP_GROUP_NAME=דיווחים מבצעי איראן 🇮🇷

GREEN_API_INSTANCE=...
GREEN_API_TOKEN=...
TG_WA_WHATSAPP_CHAT_ID=120363...@g.us

TG_WA_BRIDGE_SECRET=סוד-ארוך
# או CRON_SECRET / FEED_API_SECRET
```

### מציאת Chat ID של הקבוצה

1. חבר ב-Green API את **אותו וואטסאפ** שחבר בקבוצה «דיווחים מבצעי איראן»
2. אחרי Deploy:

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://YOUR-SITE.vercel.app/api/tg-wa-bridge/groups"
```

3. העתק את ה-`id` שמסתיים ב-`@g.us` ל-`TG_WA_WHATSAPP_CHAT_ID`
4. Redeploy

## בדיקות

```bash
# סטטוס
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://YOUR-SITE.vercel.app/api/tg-wa-bridge/status"

# הודעת בדיקה לקבוצה
curl -X POST -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"text":"*✅ בדיקה* מהגשר"}' \
  "https://YOUR-SITE.vercel.app/api/tg-wa-bridge/test"

# סריקה + שליחה
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://YOUR-SITE.vercel.app/api/cron/tg-wa-bridge"
```

## תדירות

ב-Hobby יש cron יומי. להעברה כמעט חיה — ping חיצוני כל 1–2 דקות לנתיב:

`GET /api/cron/tg-wa-bridge` עם `Authorization: Bearer …`

## מצב מיידי (אופציונלי)

אם אתה אדמין בערוץ — הוסף בוט נפרד כאדמין ורשום webhook ב-`/api/tg-wa-bridge/setup`  
(אל תדרוס את webhook של בוט החמ״ל).
