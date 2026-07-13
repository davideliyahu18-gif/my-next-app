# בוט דילי טיסות — מדריך מהיר

## Amadeus לא עובד? יש חלופות קלות יותר

| אופציה | קושי | הרשמה |
|--------|------|--------|
| **Travelpayouts** ⭐ | הכי קל | [travelpayouts.com](https://www.travelpayouts.com/) → Developers → API Token |
| **SerpAPI** | קל | [serpapi.com](https://serpapi.com/users/sign_up) — עם חשבון Google |
| **Demo** | אפס | `FLIGHT_DEALS_DEMO=true` ב-`.env.local` — בלי הרשמה |
| Amadeus | קשה | רק אם הצלחת להירשם |

---

## Travelpayouts — 3 דקות (מומלץ)

1. היכנס ל-[travelpayouts.com](https://www.travelpayouts.com/)
2. הירשם (אימייל + סיסמה, בעברית)
3. לך ל-**Developers → API** או [קישור ישיר](https://www.travelpayouts.com/developers/api)
4. העתק את ה-**Token**
5. הדבק ב-`.env.local`:
   ```
   TRAVELPAYOUTS_TOKEN=הטוקן_שלך
   ```

---

## SerpAPI — עם Google

1. [serpapi.com/users/sign_up](https://serpapi.com/users/sign_up) → **Sign up with Google**
2. העתק API Key מהדשבורד
3. הדבק ב-`.env.local`:
   ```
   SERPAPI_API_KEY=המפתח_שלך
   ```

> 250 חיפושים חינם בחודש — מספיק לבדיקות. לסריקה כל 30 דקות עדיף Travelpayouts.

---

## הפעלה

```bash
npm run flight-deals:setup
npm run flight-deals:start
```

סרוק QR → כשאגיד לך, פתח קבוצה ותגיד את השם.

---

## בדיקה מיידית (בלי שום הרשמה)

הוסף ל-`.env.local`:
```
FLIGHT_DEALS_DEMO=true
```

ישלח דיל דמו אחד לקבוצה לבדיקה.
