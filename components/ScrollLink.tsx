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
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        scrollToSection(href.replace("#", ""));
        window.history.replaceState(null, "", href);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}
