export default function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="h-9 w-1 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
          <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="mr-4 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <button className="text-sm font-semibold text-amber-400 transition-colors hover:text-amber-200">
          {action} ←
        </button>
      )}
    </div>
  );
}
