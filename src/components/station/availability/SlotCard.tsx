'use client';

interface SlotCardProps {
  slot: any;
  onUpdate: (slotId: string, updated: any) => void;
  onDelete: (slotId: string) => void;
}

export function SlotCard({ slot, onUpdate, onDelete }: SlotCardProps) {
  const startTime = new Date(slot.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(slot.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const capacity = slot.capacity;
  const booked = slot.booked_count || 0;
  const available = capacity - booked;
  const fillPercentage = (booked / capacity) * 100;

  const getStatusColor = () => {
    if (available === 0) return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
    if (available <= capacity * 0.3) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800';
    return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
  };

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-900 dark:text-white">
              {startTime} — {endTime}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Bay {slot.bay_id}</span>
          </div>

          {/* Capacity Info */}
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {booked} / {capacity}
              </span>
              <span>{available} places</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full bg-amber-600" style={{ width: `${fillPercentage}%` }} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-4 flex gap-2">
          <button
            type="button"
            onClick={() => onDelete(slot.id)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
