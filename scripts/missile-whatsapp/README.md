# בוט WhatsApp — שיגורים איראן → כווית (עם מיקום)

## אין לך Green API? זה בסדר

הריצו מקומית עם Baileys (סריקת QR):

👉 **[`START.md`](./START.md)**

```bash
cd scripts/missile-whatsapp
npm install
npm start
```

הבוט מחפש את הקבוצה **🛡️ מרכז התרעות אזורי** ושולח טקסט + מיקום.

---

## אופציה נוספת: Green API (לענן / Vercel)

רק אם תרצו שליחה מ־Vercel בלי מחשב דולק — ראו [`GREEN-API-SETUP.md`](./GREEN-API-SETUP.md).

## מקור התראות חיות

הבוט סורק OSINT בשני מסלולים:
1. `/api/missile-alerts/pending` (כש־Next רץ)
2. **סריקת Telegram מקומית** (גם אם Next כבוי)

התראות נכנסות ל־`outbox.json` ונשלחות עם מרווח + retry אחרי rate-limit/ניתוק.

```bash
npm run keep-alive   # ריסטארט אוטומטי אחרי קריסה
```

⚠️ Cloud Agent / מכונה שנכבים = פספוסים. צריך מארח דולק 24/7 (או Green API בענן).
