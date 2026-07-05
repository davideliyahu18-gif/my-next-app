export default function Loading() {
  return (
    <div dir="rtl" className="min-h-screen bg-black font-sans text-white">
      <div className="mx-auto max-w-[1440px] animate-pulse px-4 py-8 md:px-8">
        <div className="mb-8 h-64 rounded-2xl bg-[#121212]" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-3">
            <div className="h-48 rounded-2xl bg-[#121212]" />
            <div className="h-56 rounded-2xl bg-[#121212]" />
          </div>
          <div className="h-96 rounded-2xl bg-[#121212] lg:col-span-6" />
          <div className="space-y-6 lg:col-span-3">
            <div className="h-56 rounded-2xl bg-[#121212]" />
            <div className="h-48 rounded-2xl bg-[#121212]" />
          </div>
        </div>
      </div>
    </div>
  );
}
