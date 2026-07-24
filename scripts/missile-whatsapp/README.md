# בוט WhatsApp — שיגורים איראן → כווית (עם מיקום)

שולח לקבוצת WhatsApp:
1. הודעת טקסט עם משגר/יעד/ETA
2. סיכת מיקום מקורבת של אזור היעד
3. (אופציונלי) סיכת מיקום של אזור השיגור

> זה OSINT / דיווח פומבי משוער — **לא** טלמטריה צבאית חיה.

## יש לך קבוצה מוכנה?

עברו למדריך המלא: [`GREEN-API-SETUP.md`](./GREEN-API-SETUP.md)

בקצרה:
1. חברו Instance ב־Green API לאותו וואטסאפ שבחבורה
2. מצאו את `120363...@g.us` של הקבוצה
3. שימו ב־Vercel: `GREEN_API_*` + `MISSILE_WHATSAPP_CHAT_ID`
4. בדקו עם `POST /api/missile-alerts/test`

## אפשרות א׳ — Green API (Vercel / serverless)

1. צרו חשבון ב-[Green API](https://green-api.com) וחברו WhatsApp.
2. הוסיפו ב־Vercel / `.env.local`:

```bash
GREEN_API_INSTANCE=...
GREEN_API_TOKEN=...
MISSILE_WHATSAPP_CHAT_ID=120363...@g.us
CRON_SECRET=...
MISSILE_ALERT_REQUIRE_KUWAIT_MENTION=true
```

3. Deploy — `vercel.json` מריץ `/api/cron/missile-alerts` כל דקה.
4. מציאת Chat ID:

```bash
curl "https://YOUR_SITE/api/missile-alerts/groups" \
  -H "Authorization: Bearer $CRON_SECRET"
```

5. בדיקה ידנית:

```bash
curl -X POST "https://YOUR_SITE/api/missile-alerts/test" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## אפשרות ב׳ — Baileys מקומי (WhatsApp Web)

```bash
cd scripts/missile-whatsapp
npm install
# ב־.env.local בשורש הפרויקט:
# MISSILE_WHATSAPP_GROUP_NAME=השם המדויק של הקבוצה שלכם
# MISSILE_ALERT_SITE_URL=http://127.0.0.1:3000
# CRON_SECRET=...
npm start   # סרקו QR
npm run test-send
```

הסקריפט שולח `location` native של WhatsApp דרך Baileys.

## מקור הנתונים

- קריאת ערוצי טלגרם פומביים (`@newsil5`, `@shigurimisrael`)
- סינון שיגורים מאיראן הרלוונטיים לכווית (ברירת מחדל: רק כשמוזכרת כווית)
- `MISSILE_ALERT_REMAP_IRAN_LAUNCHES=true` — כל שיגור מאיראן נשלח כהתראת כווית
- `MISSILE_ALERT_REQUIRE_KUWAIT_MENTION=false` — מאפשר מסלול רחב יותר (בזהירות)

## מפת האתר

`/rockets` מציג מסלולי הדגמה / לייב איראן → כווית.
