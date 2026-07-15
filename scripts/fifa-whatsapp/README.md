# בוט מונדיאל — שלט רחוק בוואטסאפ

בוט WhatsApp (Baileys) שמקשיב לקבוצה ומגיב לפקודות, ויודע גם לשלוח התראות על שערים / סיום / תזכורת לפני משחק.

## מה צריך

1. האתר רץ מקומית (`npm run dev`) או ב-Vercel
2. מספר WhatsApp לסריקת QR (מכשיר מקושר)
3. קבוצת WhatsApp — הבוט מוצא אותה לפי שם

## הגדרה ב־`.env.local`

```bash
# כתובת האתר שהבוט מדבר איתה
FIFA_BOT_SITE_URL=http://127.0.0.1:3000

# סוד משותף ל־API (אותו ערך כמו בשרת)
FIFA_BOT_SECRET=generate-a-long-random-secret
FEED_API_SECRET=generate-a-long-random-secret
CRON_SECRET=generate-a-long-random-secret

# שם הקבוצה (חלקי מספיק) או chat id מלא
FIFA_WHATSAPP_GROUP_NAME=מונדיאל
# WHATSAPP_GROUP_CHAT_ID=120363...@g.us
```

## הפעלה

טרמינל 1 — האתר:

```bash
npm run dev
```

טרמינל 2 — הבוט:

```bash
npm run fifa-bot:setup
npm run fifa-bot:start
```

סרקו QR → הוסיפו את המספר המקושר לקבוצה → הבוט ישלח הודעת חיבור.

## פקודות שלט רחוק (בקבוצה)

| פקודה | מה קורה |
|--------|---------|
| `תוצאה` | משחקים חיים / קרובים |
| `מחר` | משחקי מחר |
| `לוח` | 6 המשחקים הבאים |
| `הרכב` | הרכבי חצי הגמר |
| `מלך שערים` | טבלת הכובשים |
| `סטטוס` / `בוט` | האם הבוט חי |
| `עזרה` | רשימת פקודות |

## התראות אוטומטיות

הבוט בודק כל דקה (`FIFA_BOT_POLL_CRON`) דרך `/api/cron/fifa-bot?dry=1` ושולח:

- ⚽️ שער
- 🏁 סיום משחק
- ⏰ תזכורת ~30 דקות לפני (ניתן לשינוי ב־`FIFA_BOT_REMINDER_MINUTES`)

כדי לכבות: `FIFA_BOT_ALERTS=false`

## בלי Baileys (Vercel + Green API)

ב-Vercel אפשר לתזמן `/api/cron/fifa-bot` ולשלוח דרך Green API / Telegram עם:

```bash
GREEN_API_INSTANCE=
GREEN_API_TOKEN=
WHATSAPP_GROUP_CHAT_ID=
```
