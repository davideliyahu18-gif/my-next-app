export type StoreCategory = "peripherals" | "displays" | "chairs" | "consoles" | "audio";

export type StoreProduct = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  compareAt?: number;
  category: StoreCategory;
  badge?: string;
  image: string;
  imageAlt: string;
};

export const STORE_BRAND = {
  name: "VOLT",
  nameHe: "וולט",
  tagline: "ה־setup שמנצח בשבילך",
  description:
    "VOLT — חנות ציוד גיימינג פרימיום: מקלדות, אוזניות, מסכים וכסאות. משלוח מהיר לכל הארץ.",
} as const;

export const STORE_CATEGORIES: {
  id: StoreCategory | "all";
  label: string;
}[] = [
  { id: "all", label: "הכל" },
  { id: "peripherals", label: "פריפריה" },
  { id: "displays", label: "מסכים" },
  { id: "audio", label: "אודיו" },
  { id: "chairs", label: "כסאות" },
  { id: "consoles", label: "קונסולות" },
];

export const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: "volt-apex-keyboard",
    name: "Apex Pro TKL",
    tagline: "מקלדת מכנית אלחוטית · מפסקים מהירים",
    price: 649,
    compareAt: 799,
    category: "peripherals",
    badge: "הכי נמכר",
    image:
      "https://images.unsplash.com/photo-1618384887929-16ec2cab24a8?w=1200&q=85",
    imageAlt: "מקלדת גיימינג מכנית מוארת על שולחן כהה",
  },
  {
    id: "volt-pulse-headset",
    name: "Pulse X Wireless",
    tagline: "אוזניות 7.1 · מיקרופון נשלף · 40 שעות סוללה",
    price: 429,
    category: "audio",
    badge: "חדש",
    image:
      "https://images.unsplash.com/photo-1599669454699-248893623440?w=1200&q=85",
    imageAlt: "אוזניות גיימינג שחורות עם תאורת LED",
  },
  {
    id: "volt-glide-mouse",
    name: "Glide Ultra",
    tagline: "עכבר 26K DPI · משקל 58g · חיישן אופטי מדויק",
    price: 289,
    compareAt: 349,
    category: "peripherals",
    image:
      "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=1200&q=85",
    imageAlt: "עכבר גיימינג ארגונומי על משטח",
  },
  {
    id: "volt-horizon-27",
    name: "Horizon 27 OLED",
    tagline: "מסך 27״ · 240Hz · HDR True Black",
    price: 2890,
    category: "displays",
    badge: "פרימיום",
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=1200&q=85",
    imageAlt: "מסך מחשב רחב על שולחן גיימינג",
  },
  {
    id: "volt-throne-chair",
    name: "Throne Ergo",
    tagline: "כיסא ארגונומי · תמיכת מותן · בד נושם",
    price: 1590,
    compareAt: 1890,
    category: "chairs",
    image:
      "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=1200&q=85",
    imageAlt: "כיסא גיימינג שחור בסטודיו",
  },
  {
    id: "volt-arena-pad",
    name: "Arena Desk Pad XL",
    tagline: "משטח 90×40 · תפרים מחוזקים · בסיס גומי",
    price: 119,
    category: "peripherals",
    image:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=85",
    imageAlt: "שולחן גיימינג עם ציוד ותאורה",
  },
  {
    id: "volt-core-console",
    name: "Core Station",
    tagline: "קונסולת דור הבא · 4K 120 · אחסון 1TB",
    price: 2190,
    category: "consoles",
    badge: "מבצע",
    image:
      "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&q=85",
    imageAlt: "קונסולת משחקים עם שלט",
  },
  {
    id: "volt-sonic-speakers",
    name: "Sonic Bar Duo",
    tagline: "רמקולים סטריאו · בס עמוק · Bluetooth 5.3",
    price: 549,
    category: "audio",
    image:
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=1200&q=85",
    imageAlt: "רמקולי שולחן שחורים",
  },
];

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=2400&q=85";

export const FEATURED_PRODUCT_ID = "volt-horizon-27";

export function formatIls(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}
