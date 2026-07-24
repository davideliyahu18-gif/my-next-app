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

כשהאתר רץ (`npm run dev` / Vercel), הבוט המקומי יכול גם למשוך התראות אמיתיות מטלגרם דרך `/api/missile-alerts/pending`.  
גם בלי האתר — בדיקות עם מיקום עובדות.
