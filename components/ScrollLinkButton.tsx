"use client";

import { scrollToSection } from "./ScrollLink";

export default function ScrollLinkButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        scrollToSection(href.replace("#", ""));
        window.history.replaceState(null, "", href);
      }}
    >
      {children}
    </button>
  );
}
