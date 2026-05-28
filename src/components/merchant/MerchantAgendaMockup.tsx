'use client';

/**
 * Decorative illustration of the station dashboard daily view.
 * Matches DashboardAgendaTimeline (top) + DashboardQueueBand (bottom)
 * visual language exactly: colors, typography, slot block structure,
 * queue card shape, and badge labels.
 */
export function MerchantAgendaMockup() {
  return (
    <div className="relative w-full max-w-[440px] mx-auto">

      {/* Floating card — top left: next client */}
      <div
        className="animate-float absolute -top-5 -left-6 z-20 bg-[#0d1f0f] border border-[rgba(200,152,10,0.25)] rounded-xl p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] min-w-[148px]"
        style={{ animationDelay: '0s' }}
      >
        <div className="text-[9px] uppercase tracking-[1.5px] text-[#7a9a7d] mb-1 font-bold">Prochain client</div>
        <div className="text-[13px] font-bold text-[#F0EDD4]">Pierre Martin</div>
        <div className="text-[20px] font-black text-[#C49A1E] leading-none">25$</div>
      </div>

      {/* Main card — mirrors real dashboard bg-white / bg-[#F7F6F2] sections */}
      <div className="bg-white rounded-2xl border border-[#E0DCD0] shadow-[0_24px_64px_rgba(0,0,0,0.12)] overflow-hidden">

        {/* ── AGENDA TIMELINE ──────────────────────────────────────── */}

        {/* Header strip: post names — mirrors DashboardAgendaTimeline header */}
        <div className="flex flex-shrink-0 border-b border-[#E0DCD0] bg-[#F7F6F2]">
          <div className="w-10 flex-shrink-0 border-r border-[#E0DCD0]" />
          <div className="flex-1 border-l border-[#E0DCD0] px-3 py-2">
            <div className="text-[11px] font-bold text-[#1A1A0A]">Poste 1</div>
            <div className="mt-0.5 text-[9px] font-bold text-[#3B82F6]">● Disponible</div>
          </div>
          <div className="flex-1 border-l border-[#E0DCD0] px-3 py-2">
            <div className="text-[11px] font-bold text-[#1A1A0A]">Poste 2</div>
            <div className="mt-0.5 text-[9px] font-bold text-[#0E8C45]">● En service</div>
          </div>
        </div>

        {/* Grid body */}
        <div className="flex overflow-hidden" style={{ height: 196 }}>

          {/* Hour gutter — mirrors sticky left gutter */}
          <div className="w-10 flex-shrink-0 border-r border-[#E0DCD0] bg-white relative">
            {/* 09:00 */}
            <div className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold tabular-nums text-[#999]" style={{ top: 2 }}>09:00</div>
            {/* 10:00 */}
            <div className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold tabular-nums text-[#999]" style={{ top: 92 }}>10:00</div>
            {/* 11:00 */}
            <div className="absolute right-1.5 -translate-y-1/2 text-[9px] font-bold tabular-nums text-[#999]" style={{ top: 182 }}>11:00</div>
          </div>

          {/* Poste 1 column */}
          <div className="flex-1 relative border-l border-[#E0DCD0]">
            {/* Hour lines — bg-[#E8E4D8] */}
            <div className="absolute left-0 right-0 h-px bg-[#E8E4D8]" style={{ top: 0 }} />
            <div className="absolute left-0 right-0 h-px bg-[#E8E4D8]" style={{ top: 90 }} />
            <div className="absolute left-0 right-0 h-px bg-[#E8E4D8]" style={{ top: 180 }} />

            {/* Now line — #C49A1E */}
            <div className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-[#C49A1E]" style={{ top: 50 }}>
              <span className="absolute -left-1 -top-[3px] block h-1.5 w-1.5 rounded-full bg-[#C49A1E]" />
            </div>

            {/* Slot: Thomas D. — confirmed → bg-[#E6EEFD] border-[#3B82F6]/50 */}
            <div
              className="absolute left-1.5 right-1.5 flex flex-col overflow-hidden rounded-lg border bg-[#E6EEFD] border-[#3B82F6]/50 px-2 py-1.5 shadow-sm"
              style={{ top: 4, height: 76 }}
            >
              <div className="flex items-start gap-1">
                <span className="text-[8px] font-bold tabular-nums text-[#1A1A0A]">09:00–09:45</span>
                <span className="ml-auto rounded-full px-1 py-0.5 text-[7px] font-black uppercase tracking-wide bg-[#3B82F6]/15 text-[#1E40AF]">À venir</span>
              </div>
              <div className="mt-0.5 truncate text-[9px] font-semibold text-[#1A1A0A]">Thomas D.</div>
              <div className="mt-auto flex items-end justify-between gap-1">
                <span className="text-[8px] text-[#666]">SUV · <span className="font-black text-[#1A1A0A]">25$</span></span>
                <span className="rounded-md px-1.5 py-0.5 text-[7px] font-black bg-[#3B82F6] text-white">Démarrer</span>
              </div>
            </div>

            {/* Slot: Julie F. — confirmed at 10:15 → top=(75min)*1.5=112.5px */}
            <div
              className="absolute left-1.5 right-1.5 flex flex-col overflow-hidden rounded-lg border bg-[#E6EEFD] border-[#3B82F6]/50 px-2 py-1.5 shadow-sm"
              style={{ top: 113, height: 68 }}
            >
              <div className="flex items-start gap-1">
                <span className="text-[8px] font-bold tabular-nums text-[#1A1A0A]">10:15–11:00</span>
                <span className="ml-auto rounded-full px-1 py-0.5 text-[7px] font-black uppercase tracking-wide bg-[#3B82F6]/15 text-[#1E40AF]">À venir</span>
              </div>
              <div className="mt-0.5 truncate text-[9px] font-semibold text-[#1A1A0A]">Julie F.</div>
              <div className="mt-auto flex items-end justify-between gap-1">
                <span className="text-[8px] text-[#666]">Berline · <span className="font-black text-[#1A1A0A]">18$</span></span>
                <span className="rounded-md px-1.5 py-0.5 text-[7px] font-black bg-[#3B82F6] text-white">Démarrer</span>
              </div>
            </div>
          </div>

          {/* Poste 2 column */}
          <div className="flex-1 relative border-l border-[#E0DCD0]">
            <div className="absolute left-0 right-0 h-px bg-[#E8E4D8]" style={{ top: 0 }} />
            <div className="absolute left-0 right-0 h-px bg-[#E8E4D8]" style={{ top: 90 }} />
            <div className="absolute left-0 right-0 h-px bg-[#E8E4D8]" style={{ top: 180 }} />

            {/* Now line */}
            <div className="pointer-events-none absolute left-0 right-0 z-20 h-px bg-[#C49A1E]" style={{ top: 50 }} />

            {/* Slot: Marc L. — in_progress → bg-[#E8F6EC] border-[#2ECC71]/60 */}
            <div
              className="absolute left-1.5 right-1.5 flex flex-col overflow-hidden rounded-lg border bg-[#E8F6EC] border-[#2ECC71]/60 px-2 py-1.5 shadow-sm"
              style={{ top: 4, height: 86 }}
            >
              <div className="flex items-start gap-1">
                <span className="text-[8px] font-bold tabular-nums text-[#1A1A0A]">09:00–10:00</span>
                <span className="ml-auto rounded-full px-1 py-0.5 text-[7px] font-black uppercase tracking-wide bg-[#2ECC71]/15 text-[#0E8C45]">En cours</span>
              </div>
              <div className="mt-0.5 truncate text-[9px] font-semibold text-[#1A1A0A]">Marc L.</div>
              <div className="mt-auto flex items-end justify-between gap-1">
                <span className="text-[8px] text-[#666]">SUV · <span className="font-black text-[#1A1A0A]">30$</span></span>
                <span className="rounded-md px-1.5 py-0.5 text-[7px] font-black bg-[#2ECC71] text-white">Terminer</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── QUEUE BAND ───────────────────────────────────────────── */}
        {/* mirrors DashboardQueueBand: bg-[#F7F6F2], rounded-2xl cards */}
        <div className="border-t border-[#E0DCD0] bg-[#F7F6F2]">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <span className="text-[11px] font-black text-[#1A1A0A]">File d&apos;attente</span>
            <span className="rounded-full bg-[#C49A1E] px-1.5 py-0.5 text-[9px] font-black leading-tight text-[#0C1209]">3</span>
            <span className="ml-auto text-[9px] font-bold text-[#C49A1E]">Voir tout →</span>
          </div>

          {/* Horizontal cards */}
          <div className="flex gap-2 px-4 pb-4 pt-1 overflow-hidden">

            {/* Call-next button — mirrors the gold play button */}
            <div className="flex h-[90px] w-[72px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-[#C49A1E] text-[#0C1209]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span className="text-center text-[8px] font-black px-1 leading-tight">Appeler suivant</span>
            </div>

            {/* Queue card 1 — NEXT, highlighted with gold border + ring */}
            <div className="flex h-[90px] w-[112px] flex-shrink-0 flex-col rounded-2xl border border-[#C49A1E] ring-1 ring-[#C49A1E]/30 bg-white p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="rounded-md bg-[#C49A1E] px-1 py-0.5 text-[7px] font-black uppercase text-[#0C1209]">SUIVANT</span>
                <span className="rounded-md px-1 py-0.5 text-[7px] font-black uppercase text-white bg-[#2ECC71]">RÉSERVÉ</span>
              </div>
              <div className="mt-1 text-[8px] font-semibold text-[#666]">SUV · 25$</div>
              <div className="truncate text-[10px] font-black text-[#1A1A0A]">Pierre M.</div>
              <div className="mt-auto rounded-lg bg-[#3B82F6] py-1 text-center text-[8px] font-black text-white">Démarrer</div>
            </div>

            {/* Queue card 2 — position #2 */}
            <div className="flex h-[90px] w-[112px] flex-shrink-0 flex-col rounded-2xl border border-[#E8E4DC] bg-white p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[12px] font-black tabular-nums text-[#1A1A0A]">#2</span>
                <span className="rounded-md px-1 py-0.5 text-[7px] font-black uppercase text-white bg-[#3B82F6]">APP</span>
              </div>
              <div className="mt-1 text-[8px] font-semibold text-[#666]">Berline · 18$</div>
              <div className="truncate text-[10px] font-black text-[#1A1A0A]">Sarah K.</div>
              <div className="mt-auto rounded-lg bg-[#3B82F6] py-1 text-center text-[8px] font-black text-white">Démarrer</div>
            </div>

          </div>
        </div>
      </div>

      {/* Floating card — bottom right: transfer received */}
      <div
        className="animate-float absolute -bottom-5 -right-4 z-20 bg-[#0d1f0f] border border-[rgba(200,152,10,0.25)] rounded-xl p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)] min-w-[140px]"
        style={{ animationDelay: '1.2s' }}
      >
        <div className="text-[9px] uppercase tracking-[1.5px] text-[#7a9a7d] mb-1 font-bold">Virement reçu</div>
        <div className="text-[20px] font-black text-[#C49A1E] leading-none">+180$</div>
        <div className="text-[9px] text-[#7a9a7d] mt-0.5">Aujourd&apos;hui</div>
      </div>
    </div>
  );
}
