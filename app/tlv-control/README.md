# 🛫 מרכז בקרה אווירי – נתב״ג

מערכת מעקב תעופתי בזמן אמת סביב נמל התעופה בן גוריון (LLBG / TLV), בעיצוב "חדר בקרה" כהה, RTL מלא, מותאמת לנייד ולדסקטופ.

## עקרון יסוד: אין המצאת נתונים

המערכת משתמשת **רק** במקורות ציבוריים וחינמיים ללא מפתח API בתשלום. אם מקור אינו זמין, המערכת מציגה במפורש **"המקור אינו זמין כרגע"** — לעולם לא נתוני דמו כאילו הם אמיתיים, ולעולם לא ניחוש/המצאה של מידע (זה נכון במיוחד לגבי התרעות פיקוד העורף — ראו בהמשך).

## הרצה

```bash
npm install   # אם צריך
npm run dev   # פיתוח, כולל Turbopack
# או
npm run build && npm start   # production build
```

הכתובת המקומית: `http://localhost:3000/tlv-control`

## משתני סביבה

**אין צורך באף משתנה סביבה.** כל המקורות המשמשים את המערכת חינמיים וללא מפתח:

| מקור | שימוש |
|---|---|
| [adsb.lol](https://adsb.lol) | מטוסים בזמן אמת (מקור ראשי) |
| [OpenSky Network](https://opensky-network.org) | מטוסים בזמן אמת (Fallback אם adsb.lol נכשל) |
| [data.gov.il](https://data.gov.il) (רשות שדות התעופה, resource `e83f763b-b7d7-479e-b172-ae981ddc6de5`) | לוח המראות/נחיתות נתב״ג |
| [Open-Meteo](https://open-meteo.com) | מזג אוויר כללי |
| [aviationweather.gov](https://aviationweather.gov) | METAR/TAF תעופתי לתחנת LLBG |
| Esri ArcGIS Online (Dark Gray Canvas + World Imagery, keyless) | שכבות מפה |

**לא נעשה שימוש** ב-FlightAware, Cirium, או כל שירות תעופתי בתשלום.

## פיקוד העורף (Oref) — מקור לא רשמי, מחובר לבקשת בעל הפרויקט

אין API רשמי, מתועד ומורשה של פיקוד העורף לשליפת התרעות בזמן אמת. לבקשת בעל הפרויקט, `lib/tlv-control/providers/oref-provider.ts` מתחבר בכל זאת ל-endpoint הבלתי-מתועד `oref.org.il/WarningMessages/alert/alerts.json` — אותו endpoint שאפליקציות צד-שלישי לא רשמיות (כמו Red Alert / Tzeva Adom) משתמשות בו בפועל. הוא לא דורש אימות ולא נעקפת בו שום הגנת אבטחה, אבל **הוא אינו נתמך/מתועד רשמית** — פיקוד העורף אינו מפרסם תנאי שימוש עבורו, והמבנה שלו יכול להשתנות בלי הודעה מוקדמת.

**חוקים שנשארים מוחלטים גם כשהמקור מחובר:**
- אם הקריאה נכשלת או שהתוכן לא נפרס בהצלחה — המערכת **תמיד** מציגה `state: "unavailable"`, גם אם יש נתון ישן שמור ב-cache. לעולם לא מוצג "אין התרעות פעילות" ישן כאילו הוא עדכני — הסיכון בהצגת "הכול תקין" שגויה גבוה מדי בפיצ'ר בטיחותי כזה.
- המערכת **לעולם לא** מסיקה או מציגה ניחוש לגבי מקור שיגור (למשל "זוהה שיגור מאיראן") — רק בדיוק את הקטגוריה ורשימת האזורים שהמקור עצמו החזיר, מילה במילה.
- בממשק תמיד מוצגת הבהרה קבועה: "מקור לא רשמי... למקרה חירום יש לפעול לפי האפליקציה הרשמית".

## ארכיטקטורה

```
lib/tlv-control/
  types/           טיפוסי TypeScript מרכזיים
  cache/           TtlCache גנרי + globalThis singleton per key
  utils/           geo, source-health, flight-search
  providers/       adsb-lol, opensky, aircraft-provider (fallback chain),
                   bgn-flights, weather-open-meteo, aviation-weather, oref-provider

app/api/tlv/
  aircraft/        GET ?radius=25|50|100|150
  flights/         GET (לוח מלא) או ?q=&date= (חיפוש)
  weather/         GET
  aviation-weather/ GET
  alerts/          GET (Oref — תמיד unavailable כרגע)
  health/          GET (סטטוס per-source: connected/stale/unavailable + latency)

components/tlv-control/   כל רכיבי ה-UI (Header, Nav, LiveMap, FlightBoard, וכו')
app/tlv-control/          page.tsx + layout.tsx (metadata/manifest ייעודיים) + tlv-control.css
```

כל ה-API routes הם `force-dynamic`, `runtime="nodejs"`, עם `Cache-Control: no-store` — הדפדפן תמיד מקבל את המידע הכי עדכני מה-cache השרתי (TTL קצר + דה-דופליקציה של בקשות מקבילות).

## ניווט (8 מסכים)

🌐 מפה חיה · 🛫 המראות · 🛬 נחיתות · 📅 טיסות לפי תאריך · 🔍 חיפוש טיסה · 🎯 מטוסים מסביב · ☁️ מזג אוויר · 🔔 התרעות

## עיצוב

חדר בקרה כהה (`#050b14`), פאנלי זכוכית (`backdrop-blur`), RTL מלא, `100dvh`/`100svh` + `env(safe-area-inset-*)` לתמיכה במכשירים עם notch/Dynamic Island. צבעים סמנטיים: כחול=מידע, ירוק=תקין/בזמן, כתום=אזהרה, אדום=התרעה/עיכוב.

## פריסה (Deploy) לוורסל

הפרויקט הזה חי באותו repo כמו `/iran-airspace` ותכונות נוספות. אם יש פרויקט Vercel נפרד המיובא מאותו repo:

1. ודאו שה-branch שהמערכת נדחפת אליו מוגדר כ-Production Branch באותו פרויקט Vercel, או קדמו את ה-deployment הרלוונטי ידנית ("Promote to Production").
2. אין צורך בהגדרת Environment Variables כלשהם.
3. אם Vercel Deployment Protection מופעל, יש לבטל אותו או לגשת דרך קישור ה-bypass כדי לצפות בעמוד ללא התחברות.

## מגבלות ידועות

- **adsb.lol / OpenSky** — כיסוי תלוי בשיתוף נתונים מגורם אחר (community feeders); ייתכנו רגעים בהם מטוסים בטווח לא מדווחים.
- **aviationweather.gov** — הקוד קורא את השדות בצורה "מגוננת" (מנסה כמה שמות שדה אפשריים) כי לא ניתן היה לאמת את הסכימה המדויקת מסביבת הפיתוח המבודדת; אם השירות משנה פורמט, ה-parsing עשוי להזדקק לעדכון.
- **data.gov.il (BGN flights)** — תלוי בזמינות ה-resource הציבורי של רשות שדות התעופה; אם ה-resource ID ישתנה, יש לעדכן ב-`lib/flights/constants.ts` (המשותף) ו/או `lib/tlv-control/providers/bgn-flights.ts`.
- **Oref** — לא מחובר בפועל, במכוון, כמפורט למעלה.
