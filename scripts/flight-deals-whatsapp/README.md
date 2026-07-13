# Flight Deals WhatsApp Bot

בוט שבודק כל **30 דקות** טיסות **הלוך-חזור** מ-**תל אביב (TLV)** לכל יעד במחיר עד **$50**, ושולח לקבוצת WhatsApp את **תאריכי היציאה והחזרה** של כל דיל.

## שתי דרכי הפעלה

### אופציה A — Vercel Cron + Green API (מומלץ לפרודקשן)

1. הירשם ב-[Amadeus for Developers](https://developers.amadeus.com/) (חינם לבדיקות).
2. הירשם ב-[Green API](https://green-api.com/) וסרוק QR לחיבור WhatsApp.
3. צור קבוצת WhatsApp חדשה והעתק את ה-`chatId` (פורמט: `972...@g.us`).
4. הגדר ב-Vercel את משתני הסביבה מ-`.env.example`.
5. פרוס — ה-cron ב-`vercel.json` ירוץ אוטומטית כל 30 דקות.

### אופציה B — סקריפט מקומי עם Baileys (חינם, דורש מחשב/VPS דלוק)

```bash
cd scripts/flight-deals-whatsapp
npm install
# העתק משתני סביבה ל-.env בשורש הפרויקט או לקובץ מקומי
export AMADEUS_CLIENT_ID=...
export AMADEUS_CLIENT_SECRET=...
export WHATSAPP_GROUP_CHAT_ID=120363...@g.us
npm start
```

בהפעלה ראשונה — סרוק QR ב-WhatsApp → **מכשירים מקושרים**.

## משתני סביבה

| משתנה | תיאור |
|--------|--------|
| `AMADEUS_CLIENT_ID` | מפתח API מ-Amadeus |
| `AMADEUS_CLIENT_SECRET` | סוד API מ-Amadeus |
| `FLIGHT_DEALS_MAX_PRICE_USD` | מקסימום מחיר (ברירת מחדל: 50) |
| `WHATSAPP_GROUP_CHAT_ID` | מזהה קבוצה (Green API או Baileys) |
| `GREEN_API_INSTANCE` | מספר instance ב-Green API |
| `GREEN_API_TOKEN` | טוקן Green API |
| `CRON_SECRET` | אבטחת endpoint ה-cron ב-Vercel |
| `TELEGRAM_BOT_TOKEN` | חלופה לטלגרם במקום WhatsApp |
| `TELEGRAM_CHAT_ID` | מזהה קבוצת טלגרם |

## API

- `GET /api/flight-deals` — דילים אחרונים שנמצאו
- `GET /api/cron/flight-deals` — סריקה ידנית (דורש `Authorization: Bearer <CRON_SECRET>`)

## דוגמת הודעה

```
🛫 דיל טיסה עד $50!

✈️ מסלול: תל אביב (TLV) ↔ אתונה (ATH)
📅 יציאה: 15/08/2026
📅 חזרה: 22/08/2026
💰 מחיר: $48.50 (הלוך-חזור)
```

## הערות

- מחירים מגיעים מ-**Amadeus** (מאגר רשמי של חברות תעופה) — לא scraping ישיר של אתרים.
- דילים ב-$50 מישראל **נדירים**; הבוט ישלח רק כשיש תוצאות אמיתיות.
- לפרודקשן עם מחירים אמיתיים, החלף ל-`AMADEUS_API_BASE=https://api.amadeus.com`.
