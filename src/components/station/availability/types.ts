export interface AvailabilityBlock {
    id: string;
    ids?: string[];      // all slot IDs when this block represents a merged group
    dates: string[];     // ISO date strings: "2026-02-10"
    startTime: string;   // "12:00"
    endTime: string;     // "13:00"
    bayIds: string[];    // ["1", "2"] or ["all"] for all bays
}
