"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FEATURED_PRODUCT_ID,
  formatIls,
  HERO_IMAGE,
  STORE_BRAND,
  STORE_CATEGORIES,
  STORE_PRODUCTS,
  type StoreCategory,
  type StoreProduct,
} from "@/lib/store/products";

type CartLine = {
  product: StoreProduct;
  qty: number;
};

export default function StoreShell() {
  const [scrolled, setScrolled] = useState(false);
  const [category, setCategory] = useState<StoreCategory | "all">("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  const featured = STORE_PRODUCTS.find((p) => p.id === FEATURED_PRODUCT_ID);

  const products = useMemo(
    () =>
      (category === "all"
        ? STORE_PRODUCTS
        : STORE_PRODUCTS.filter((p) => p.category === category)
      ).filter((p) => p.id !== FEATURED_PRODUCT_ID || category !== "all"),
    [category],
  );

  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const total = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  function addToCart(product: StoreProduct) {
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, qty: line.qty + 1 }
            : line,
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setCartOpen(true);
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.product.id === id
            ? { ...line, qty: line.qty + delta }
            : line,
        )
        .filter((line) => line.qty > 0),
    );
  }

  return (
    <div className="volt-store" dir="rtl">
      <header className={`volt-nav${scrolled ? " is-scrolled" : ""}`}>
        <Link href="/store" className="volt-brand" aria-label={STORE_BRAND.name}>
          {STORE_BRAND.shortName}
          <span> בע״מ</span>
        </Link>

        <nav className="volt-nav-links" aria-label="ניווט ראשי">
          <a href="#catalog">קטלוג</a>
          <a href="#drop">דרופ השבוע</a>
          <a href="#about">אודות</a>
          <Link href="/">חזרה לאתר</Link>
        </nav>

        <div className="volt-nav-actions">
          <button
            type="button"
            className="volt-cart-btn"
            onClick={() => setCartOpen(true)}
            aria-label={`סל קניות, ${itemCount} פריטים`}
          >
            סל
            {itemCount > 0 && (
              <span key={itemCount} className="volt-cart-count">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <section className="volt-hero" aria-label="פתיחה">
        <div className="volt-hero-media">
          <Image
            src={HERO_IMAGE}
            alt="קונסולת משחקים ושולחן גיימינג מואר"
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="volt-hero-shade" aria-hidden />
        <div className="volt-hero-content">
          <p className="volt-hero-brand">{STORE_BRAND.name}</p>
          <h1 className="volt-hero-title">{STORE_BRAND.tagline}</h1>
          <p className="volt-hero-copy">
            ציוד מדויק לסשנים ארוכים — נשלח עד הבית תוך 48 שעות.
          </p>
          <div className="volt-hero-ctas">
            <a className="volt-btn volt-btn-primary" href="#catalog">
              כניסה לקטלוג
            </a>
            <a className="volt-btn volt-btn-ghost" href="#drop">
              דרופ השבוע
            </a>
          </div>
        </div>
      </section>

      <section id="catalog" className="volt-section" aria-labelledby="catalog-title">
        <div className="volt-section-head">
          <h2 id="catalog-title">הקטלוג</h2>
          <p>פריפריה, מסכים, אודיו וכיסאות — נבחרים לסשנים שלא נגמרים.</p>
        </div>

        {featured && category === "all" && (
          <article className="volt-featured">
            <div className="volt-featured-media">
              <Image
                src={featured.image}
                alt={featured.imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, 55vw"
              />
            </div>
            <div className="volt-featured-body">
              <p className="volt-featured-kicker">בחירת העורך</p>
              <h3>{featured.name}</h3>
              <p>{featured.tagline}</p>
              <div className="volt-featured-row">
                <div className="volt-price">
                  <span>{formatIls(featured.price)}</span>
                  {featured.compareAt && <s>{formatIls(featured.compareAt)}</s>}
                </div>
                <button
                  type="button"
                  className="volt-btn volt-btn-primary"
                  onClick={() => addToCart(featured)}
                >
                  הוסף לסל
                </button>
              </div>
            </div>
          </article>
        )}

        <div className="volt-filters" role="tablist" aria-label="סינון קטגוריות">
          {STORE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={category === cat.id}
              className={`volt-filter${category === cat.id ? " is-active" : ""}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="volt-grid">
          {products.map((product) => (
            <article key={product.id} className="volt-product">
              <div className="volt-product-media">
                {product.badge && (
                  <span className="volt-product-badge">{product.badge}</span>
                )}
                <Image
                  src={product.image}
                  alt={product.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw"
                />
              </div>
              <div className="volt-product-body">
                <h3>{product.name}</h3>
                <p>{product.tagline}</p>
                <div className="volt-product-row">
                  <div className="volt-price">
                    <span>{formatIls(product.price)}</span>
                    {product.compareAt && (
                      <s>{formatIls(product.compareAt)}</s>
                    )}
                  </div>
                  <button
                    type="button"
                    className="volt-add"
                    onClick={() => addToCart(product)}
                  >
                    הוסף לסל
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="drop" className="volt-drop" aria-labelledby="drop-title">
        <div className="volt-drop-panel">
          <Image
            src="https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=1800&q=85"
            alt="מסך וקונסולת משחקים בסלון"
            fill
            sizes="100vw"
          />
          <div className="volt-drop-shade" aria-hidden />
          <div className="volt-drop-copy">
            <p className="volt-drop-kicker">Weekly Drop</p>
            <h2 id="drop-title">Horizon 27 OLED — חודש ההשקה</h2>
            <p>
              240Hz, שחורים אמיתיים וזמן תגובה כמעט מיידי. מלאי מוגבל למשלוח
              השבוע.
            </p>
            <a className="volt-btn volt-btn-primary" href="#catalog">
              לצפייה במסך
            </a>
          </div>
        </div>
      </section>

      <footer id="about" className="volt-footer">
        <div>
          <p className="volt-footer-brand">{STORE_BRAND.name}</p>
          <p>{STORE_BRAND.description}</p>
        </div>
        <div className="volt-footer-meta">
          <span>משלוח עד 48 שעות · מרכז הארץ</span>
          <span>אחריות יבואן רשמי</span>
          <a href="mailto:hello@volt.store">hello@volt.store</a>
          <Link href="/">כדורגל בזמן אמת</Link>
        </div>
      </footer>

      <div
        className={`volt-cart-backdrop${cartOpen ? " is-open" : ""}`}
        onClick={() => setCartOpen(false)}
        aria-hidden={!cartOpen}
      />

      <aside
        className={`volt-cart-drawer${cartOpen ? " is-open" : ""}`}
        aria-hidden={!cartOpen}
        aria-label="סל קניות"
      >
        <div className="volt-cart-head">
          <h2>הסל שלך</h2>
          <button
            type="button"
            className="volt-cart-close"
            onClick={() => setCartOpen(false)}
            aria-label="סגור סל"
          >
            ✕
          </button>
        </div>

        <div className="volt-cart-body">
          {cart.length === 0 ? (
            <p className="volt-cart-empty">הסל ריק — בואו נתחיל לבנות setup.</p>
          ) : (
            cart.map((line) => (
              <div key={line.product.id} className="volt-cart-item">
                <div className="volt-cart-item-media">
                  <Image
                    src={line.product.image}
                    alt={line.product.imageAlt}
                    fill
                    sizes="72px"
                  />
                </div>
                <div>
                  <h3>{line.product.name}</h3>
                  <p>{formatIls(line.product.price)}</p>
                  <div className="volt-qty">
                    <button
                      type="button"
                      onClick={() => updateQty(line.product.id, -1)}
                      aria-label="הפחת כמות"
                    >
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(line.product.id, 1)}
                      aria-label="הוסף כמות"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="volt-cart-item-price">
                  {formatIls(line.product.price * line.qty)}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="volt-cart-foot">
          <div className="volt-cart-total">
            <span>סה״כ</span>
            <span>{formatIls(total)}</span>
          </div>
          <button
            type="button"
            className="volt-btn volt-btn-primary"
            disabled={cart.length === 0}
            onClick={() => {
              setCart([]);
              setCartOpen(false);
            }}
          >
            לתשלום (דמו)
          </button>
        </div>
      </aside>
    </div>
  );
}
