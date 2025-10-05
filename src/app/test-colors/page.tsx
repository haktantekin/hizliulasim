export default function TestColorsPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold mb-6">Tailwind Color Test</h1>
      
      {/* Basic Colors */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Basic Colors</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-100 p-4 rounded">bg-slate-100</div>
          <div className="bg-gray-100 p-4 rounded">bg-gray-100</div>
          <div className="bg-zinc-100 p-4 rounded">bg-zinc-100</div>
        </div>
      </div>

      {/* Primary Colors */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Primary Colors</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-100 text-red-700 p-4 rounded">bg-red-100</div>
          <div className="bg-orange-100 text-orange-700 p-4 rounded">bg-orange-100</div>
          <div className="bg-yellow-100 text-yellow-700 p-4 rounded">bg-yellow-100</div>
          <div className="bg-lime-100 text-lime-700 p-4 rounded">bg-lime-100</div>
        </div>
      </div>

      {/* Blue/Green Spectrum */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Blue/Green Spectrum</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-100 text-green-700 p-4 rounded">bg-green-100</div>
          <div className="bg-emerald-100 text-emerald-700 p-4 rounded">bg-emerald-100</div>
          <div className="bg-teal-100 text-teal-700 p-4 rounded">bg-teal-100</div>
          <div className="bg-cyan-100 text-cyan-700 p-4 rounded">bg-cyan-100</div>
        </div>
      </div>

      {/* Blue/Purple Spectrum */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Blue/Purple Spectrum</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-sky-100 text-sky-700 p-4 rounded">bg-sky-100</div>
          <div className="bg-blue-100 text-blue-700 p-4 rounded">bg-blue-100</div>
          <div className="bg-indigo-100 text-indigo-700 p-4 rounded">bg-indigo-100</div>
          <div className="bg-violet-100 text-violet-700 p-4 rounded">bg-violet-100</div>
        </div>
      </div>

      {/* Pink/Purple */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Pink/Purple</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-100 text-purple-700 p-4 rounded">bg-purple-100</div>
          <div className="bg-fuchsia-100 text-fuchsia-700 p-4 rounded">bg-fuchsia-100</div>
          <div className="bg-pink-100 text-pink-700 p-4 rounded">bg-pink-100</div>
        </div>
      </div>

      {/* Your Problematic Case */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Your Problematic Classes</h2>
        <div className="bg-emerald-100 text-emerald-700 min-w-[140px] relative p-4 rounded-xl font-medium text-xs hover:opacity-80 transition-opacity flex gap-1.5 min-h-[100px] flex-col items-center">
          All classes combined
        </div>
      </div>

      {/* Brand Colors */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Brand Colors</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-brand-soft-blue text-white p-4 rounded">bg-brand-soft-blue</div>
          <div className="bg-brand-dark-blue text-white p-4 rounded">bg-brand-dark-blue</div>
          <div className="bg-brand-light-blue p-4 rounded">bg-brand-light-blue</div>
          <div className="bg-brand-yellow p-4 rounded">bg-brand-yellow</div>
          <div className="bg-brand-green p-4 rounded">bg-brand-green</div>
        </div>
      </div>
    </div>
  );
}