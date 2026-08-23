"use client";

type TeamCrestProps = {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
};

export default function TeamCrest({
  src,
  name,
  size = 22,
  className = "",
}: TeamCrestProps) {
  if (!src) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-black text-zinc-400 ${className}`}
        style={{ width: size, height: size }}
      >
        {name.trim().slice(0, 1) || "•"}
      </span>
    );
  }

  return (
    // External CDN crest — plain img keeps SSR simple and avoids next/image config churn.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden";
      }}
    />
  );
}
