"use client";

type ScrollLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
};

export function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ScrollLink({
  href,
  className,
  children,
  onNavigate,
}: ScrollLinkProps) {
  const isHash = href.startsWith("#");
  const isHomeHash = href.startsWith("/#");

  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (!isHash && !isHomeHash) return;
        if (isHomeHash && typeof window !== "undefined" && window.location.pathname !== "/") {
          onNavigate?.();
          return;
        }
        event.preventDefault();
        const id = href.replace(/^\/?#/, "");
        scrollToSection(id);
        window.history.replaceState(null, "", `#${id}`);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}
