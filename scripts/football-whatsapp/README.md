# בוט כדורגל — כל הליגות (WhatsApp)

בוט WhatsApp (Baileys) שמביא התראות כדורגל ממקור **FIFA** ושולח לקבוצה.

## מה הוא עושה

- התראות אוטומטיות: **שער · פתיחה · מחצית · סיום · תזכורת 30 דק׳**
- שלט רחוק בקבוצה: `תוצאה` · `מחר` · `לוח` · `ליגות` · `עזרה`
- קישור במכשיר מקושר עם **סריקת ברקוד (QR)**

## 1) הגדרה ב־`.env.local`

```bash
FOOTBALL_BOT_SITE_URL=http://127.0.0.1:3000
FOOTBALL_BOT_SECRET=generate-a-long-random-secret
FEED_API_SECRET=generate-a-long-random-secret

# שם הקבוצה (חלקי מספיק) — או chat id מלא אחרי החיבור
FOOTBALL_WHATSAPP_GROUP_NAME=דוד | עדכוני כדורגל
# FOOTBALL_WHATSAPP_CHAT_ID=120363...@g.us

# אופציונלי — מקור FIFA שתביא:
# FOOTBALL_FIFA_BASE_URL=https://api.fifa.com/api/v3
# FOOTBALL_FIFA_COMPETITIONS=17,10005,158
# או JSON:
# FOOTBALL_FIFA_COMPETITIONS=[{"id":"17","nameHe":"גביע העולם","seasonId":"285023"}]
```

## 2) הפעלה + סריקת ברקוד

טרמינל 1 — אתר:

```bash
npm run dev
```

טרמינל 2 — בוט:

```bash
npm run football-bot:setup
npm run football-bot:start
```

יופיע QR בטרמינל + קובץ:

`scripts/football-whatsapp/qr.png`

בטלפון: **WhatsApp → הגדרות → מכשירים מקושרים → קישור מכשיר → סרוק**.

## 3) שליחה לקבוצה

1. צרו / היכנסו לקבוצה (למשל `דוד | עדכוני כדורגל`)
2. הוסיפו את **המספר המקושר** לקבוצה
3. הבוט שולח הודעת «בוט כדורגל מחובר»
4. כתבו בקבוצה `עזרה` או `תוצאה`

## מקור FIFA

הלקוח נמצא ב־`src/football/fifaLiveClient.ts`:

| קריאה | נתיב |
|--------|------|
| גילוי משחקים | `GET /calendar/matches` — `language` · `count` · `idCompetition` · `idSeason` · `from` · `to` (YYYY-MM-DD) |
| לייב | `GET /live/football/{fifaMatchId}` — `language` · `_={timestamp}` |
| ציר אירועים | `GET /timelines/{fifaMatchId}` — `language` · `_={timestamp}` |

ברירת מחדל:
```bash
FOOTBALL_FIFA_BASE_URL=https://api.fifa.com/api/v3
FIFA_ID_COMPETITION=17
FIFA_ID_SEASON=285023
FIFA_API_LANGUAGE=en
FOOTBALL_MATCH_COUNT=500
```

כשתביא מקור FIFA / מזהי ליגות נוספים — עדכן `FOOTBALL_FIFA_COMPETITIONS`.

## פקודות

| פקודה | מה קורה |
|--------|---------|
| `תוצאה` | משחקים חיים / קרובים |
| `מחר` | משחקי מחר |
| `לוח` | המשחקים הבאים |
| `ליגות` | רשימת ליגות במעקב |
| `סטטוס` / `בוט` | האם הבוט חי |
| `עזרה` | רשימת פקודות |

## חיבור מחדש

```bash
rm -rf scripts/football-whatsapp/auth
npm run football-bot:start
```

סרקו ברקוד חדש.
