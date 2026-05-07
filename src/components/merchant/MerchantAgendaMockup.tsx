'use client';

export function MerchantAgendaMockup() {
  return (
    <div className="relative w-full max-w-[440px] mx-auto">
      {/* Floating card - top left */}
      <div className="animate-float absolute -top-5 -left-6 z-20 bg-[#0d1f0f] border border-[rgba(200,152,10,0.25)] rounded-xl p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] min-w-[148px]">
        <div className="font-dm-mono text-[10px] uppercase tracking-[1.5px] text-[#7a9a7d] mb-1">Prochain client</div>
        <div className="font-rajdhani text-[16px] font-bold text-[#fef9e7]">Pierre Martin</div>
        <div className="font-rajdhani text-[20px] font-bold text-[#c8980a] leading-none">25$</div>
      </div>

      {/* Main card */}
      <div className="bg-[#f5edd6] rounded-2xl border border-[rgba(200,152,10,0.28)] shadow-[0_24px_64px_rgba(0,0,0,0.22)] overflow-hidden">
        {/* Header */}
        <div className="bg-[#0d1f0f] px-5 py-3 flex items-center justify-between">
          <span className="font-dm-mono text-[11px] uppercase tracking-[2px] text-[#c8980a]">Tableau de bord</span>
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[rgba(200,152,10,0.4)]" />
            <span className="w-2 h-2 rounded-full bg-[rgba(200,152,10,0.25)]" />
            <span className="w-2 h-2 rounded-full bg-[rgba(200,152,10,0.15)]" />
          </div>
        </div>

        <div className="flex gap-0">
          {/* Queue column */}
          <div className="w-[44%] border-r border-[rgba(61,42,16,0.12)] p-4">
            <div className="font-dm-mono text-[10px] uppercase tracking-[1.5px] text-[#7a9a7d] mb-3">File d&apos;attente</div>
            <div className="flex flex-col gap-2.5">
              {[
                { name: 'Julien R.', badge: 'Réservé', color: 'bg-[#00C851] text-white' },
                { name: 'Marie C.', badge: 'En cours', color: 'bg-[#c8980a] text-[#0d1f0f]' },
                { name: 'Luca B.', badge: 'À venir', color: 'bg-[#3b82f6] text-white' },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#3d2a10]">{row.name}</span>
                  <span className={`font-dm-mono text-[9px] px-1.5 py-0.5 rounded-sm font-medium ${row.color}`}>
                    {row.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Planning grid */}
          <div className="flex-1 p-4">
            <div className="font-dm-mono text-[10px] uppercase tracking-[1.5px] text-[#7a9a7d] mb-3">Planning</div>
            {/* Grid header */}
            <div className="grid grid-cols-[40px_1fr_1fr] gap-1.5 mb-2">
              <div />
              <div className="font-dm-mono text-[9px] text-center text-[#7a9a7d] uppercase tracking-[1px]">Poste 1</div>
              <div className="font-dm-mono text-[9px] text-center text-[#7a9a7d] uppercase tracking-[1px]">Poste 2</div>
            </div>
            {/* Time rows */}
            {[
              { time: '09:00', col1: { label: 'SUV', color: 'bg-[rgba(200,152,10,0.2)] border-l-2 border-[#c8980a]' }, col2: { label: 'Berline', color: 'bg-[rgba(0,200,81,0.15)] border-l-2 border-[#00C851]' } },
              { time: '10:00', col1: { label: 'Berline', color: 'bg-[rgba(59,130,246,0.15)] border-l-2 border-[#3b82f6]' }, col2: null },
              { time: '11:00', col1: null, col2: { label: 'SUV', color: 'bg-[rgba(200,152,10,0.2)] border-l-2 border-[#c8980a]' } },
            ].map((row) => (
              <div key={row.time} className="grid grid-cols-[40px_1fr_1fr] gap-1.5 mb-1.5">
                <div className="font-dm-mono text-[10px] text-[#7a9a7d] flex items-center">{row.time}</div>
                <div className={`rounded-sm px-1.5 py-1 min-h-[26px] flex items-center ${row.col1 ? row.col1.color : ''}`}>
                  {row.col1 && <span className="text-[10px] font-semibold text-[#3d2a10]">{row.col1.label}</span>}
                </div>
                <div className={`rounded-sm px-1.5 py-1 min-h-[26px] flex items-center ${row.col2 ? row.col2.color : ''}`}>
                  {row.col2 && <span className="text-[10px] font-semibold text-[#3d2a10]">{row.col2.label}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating card - bottom right */}
      <div className="animate-float absolute -bottom-5 -right-4 z-20 bg-[#0d1f0f] border border-[rgba(200,152,10,0.25)] rounded-xl p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] min-w-[148px]" style={{ animationDelay: '1.2s' }}>
        <div className="font-dm-mono text-[10px] uppercase tracking-[1.5px] text-[#7a9a7d] mb-1">Virement reçu</div>
        <div className="font-rajdhani text-[22px] font-bold text-[#c8980a] leading-none">+180$</div>
        <div className="font-dm-mono text-[10px] text-[#7a9a7d] mt-0.5">Aujourd&apos;hui</div>
      </div>
    </div>
  );
}
