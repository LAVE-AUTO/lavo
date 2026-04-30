'use client';

interface SlotCardProps {
  slot: any;
  onUpdate: (slotId: string, updated: any) => void;
  onDelete: (slotId: string) => void;
}

export function SlotCard({ slot, onUpdate: _onUpdate, onDelete }: SlotCardProps) {
  const startTime = new Date(slot.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(slot.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const capacity: number = slot.capacity;
  const booked: number = slot.booked_count || 0;
  const available = capacity - booked;
  const fillPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

  const statusColor = available === 0 ? '#FF2525' : available <= capacity * 0.3 ? '#FF8800' : '#00C851';
  const statusLabel = available === 0 ? 'Complet' : available <= capacity * 0.3 ? 'Presque plein' : 'Disponible';
  const barColor = fillPct >= 90 ? '#FF2525' : fillPct >= 60 ? '#FF8800' : '#00C851';
  const borderStyle = `4px solid ${statusColor}`;

  return (
    <div
      className="rounded-xl bg-[#F0EDE0] p-4 transition-all duration-200 hover:shadow-md dark:bg-[#1E2A1A]"
      style={{ borderLeft: borderStyle }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Time + Bay */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-[#1A1A0A] dark:text-[#F0EDD4]">
              {startTime} — {endTime}
            </span>
            <span className="rounded-full bg-[#C09A18]/15 px-2 py-0.5 text-[11px] font-semibold text-[#C09A18]">
              Poste {slot.bay_id}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Fill bar */}
          <div className="mb-1 flex items-center justify-between text-xs text-[#666] dark:text-[#A0A090]">
            <span>
              {booked} réservé{booked > 1 ? 's' : ''} sur {capacity}
            </span>
            <span className="font-semibold" style={{ color: barColor }}>
              {available} place{available > 1 ? 's' : ''} libre{available > 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1A1A0A]/10 dark:bg-[#F0EDD4]/10">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${fillPct}%`, backgroundColor: barColor }}
            />
          </div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(slot.id)}
          aria-label="Supprimer ce créneau"
          className="cursor-pointer rounded-lg p-1.5 text-[#FF2525] transition-colors hover:bg-[#FF2525]/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
        </button>
      </div>
    </div>
  );
}
