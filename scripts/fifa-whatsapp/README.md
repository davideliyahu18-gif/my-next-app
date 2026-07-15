# בוט מונדיאל — LIVE + VIP

בוט WhatsApp (Baileys) לשתי קבוצות, עם ניתוב התראות שונה לכל אחת.

## הקבוצות

| קבוצה | שם לדוגמה | מה נשלח |
|--------|-----------|---------|
| **MAIN / LIVE** | `🏆 דוד \| עדכוני מונדיאל LIVE ⚽🔥` | הכל **חוץ מקרנות** |
| **VIP** | `🔥⚽ דוד VIP עדכוני מונדיאל` | הכל **חוץ משערים** (כולל קרנות, מחצית, סיום, פנדלים…) |

שלט רחוק (`תוצאה`, `עזרה`…) עובד בשתי הקבוצות.

## הגדרה ב־`.env.local`

```bash
FIFA_BOT_SITE_URL=http://127.0.0.1:3000
FIFA_BOT_SECRET=generate-a-long-random-secret
FEED_API_SECRET=generate-a-long-random-secret
CRON_SECRET=generate-a-long-random-secret

# חיפוש לפי שם (חלקי מספיק) — או chat id מלא
FIFA_WHATSAPP_MAIN_GROUP_NAME=דוד | עדכוני מונדיאל LIVE
FIFA_WHATSAPP_VIP_GROUP_NAME=דוד VIP עדכוני מונדיאל
# FIFA_WHATSAPP_MAIN_CHAT_ID=120363...@g.us
# FIFA_WHATSAPP_VIP_CHAT_ID=120363...@g.us
```

## הפעלה

```bash
npm run dev
npm run fifa-bot:setup
npm run fifa-bot:start
```

סרקו QR → הוסיפו את המספר המקושר **לשתי הקבוצות** → הבוט ישלח הודעת חיבור לכל אחת.

## פקודות

| פקודה | מה קורה |
|--------|---------|
| `תוצאה` | משחקים חיים / קרובים |
| `מחר` | משחקי מחר |
| `לוח` | 6 המשחקים הבאים |
| `הרכב` | הרכבי חצי הגמר |
| `מלך שערים` | טבלת הכובשים |
| `סטטוס` / `בוט` | האם הבוט חי |
| `עזרה` | רשימת פקודות |

## Green API (Vercel / cloud poller)

```bash
GREEN_API_INSTANCE=
GREEN_API_TOKEN=
GREEN_API_HOST=https://7107.api.green-api.com
FIFA_WHATSAPP_MAIN_CHAT_ID=
FIFA_WHATSAPP_VIP_CHAT_ID=
FIFA_BOT_POLL_MS=5000
FIFA_BOT_IDLE_POLL_MS=20000
```

פולר מהיר (בלי Baileys):

```bash
npm run dev
npm run fifa-bot:poll
```

בזמן משחק חי / לפני שריקה — סריקה כל ~5 שניות (שער, קרן, מחצית, מחצית שנייה, פתיחה, סיום).
