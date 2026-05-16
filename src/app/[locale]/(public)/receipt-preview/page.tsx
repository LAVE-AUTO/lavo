'use client';

import { useState } from 'react';
import { BookingReceipt } from '@/components/stations/booking/BookingReceipt';
import { ReceiptModal } from '@/components/history/ReceiptModal';
import type {
  StationDetailData,
  StationServicePublic,
  StationServiceEntry,
  StationServiceExtra,
} from '@/types/station';

export default function ReceiptPreviewPage() {
  const [showModal, setShowModal] = useState(true);
  const mode = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('mode')
    : null;
  const bookingOnly = mode === 'booking';
  const historyOnly = mode === 'history';

  const station = {
    name: 'Hurryline Downtown',
    address: '245 Sainte-Catherine St W',
    city: 'Montreal',
  } as unknown as StationDetailData;

  const service = { name: 'Premium Exterior + Interior' } as unknown as StationServicePublic;
  const entry = { formatLabel: 'SUV' } as unknown as StationServiceEntry;
  const extras = [
    { id: '1', name: 'Tire Shine', price: 8 },
    { id: '2', name: 'Wax Finish', price: 12 },
  ] as unknown as StationServiceExtra[];

  return (
    <main className="min-h-screen bg-[#0a0f0c] py-8 px-4">
      <div className={`max-w-5xl mx-auto ${bookingOnly || historyOnly ? 'grid gap-8 grid-cols-1 items-start justify-items-center' : 'grid gap-8 lg:grid-cols-2 items-start'}`}>
        {!historyOnly && (
        <section>
          <h1 className="text-[#E4C06A] text-xs font-black tracking-[0.22em] uppercase mb-3">Booking Success Receipt</h1>
          <BookingReceipt
            station={station}
            service={service}
            entry={entry}
            extras={extras}
            arrivalMode="queue_later"
            selectedDate="2026-05-16"
            laterTime="16:30"
            selectedSlotTime={null}
            servicePrice={45}
            extrasTotal={20}
            surchargeAmount={5}
            grandTotal={70}
            ticketCode="H7K9P2"
            queuePosition={4}
          />
        </section>
        )}

        {!bookingOnly && (
        <section className="relative min-h-[680px] w-full max-w-md rounded-3xl border border-[#2a3128] bg-[#0c100d] overflow-hidden">
          <div className="p-5">
            <h2 className="text-[#E4C06A] text-xs font-black tracking-[0.22em] uppercase">History Receipt Modal</h2>
            <p className="text-[#8a927f] text-sm mt-2">Rendered as client-history user flow modal.</p>
          </div>
          {showModal && (
            <ReceiptModal
              entry={{
                id: 'rcpt-2026-0019',
                stationName: 'Hurryline Downtown',
                stationAddress: '245 Sainte-Catherine St W, Montreal',
                vehicleFormatLabel: 'SUV',
                entryType: 'reservation',
                amountPaid: 70,
                tipAmount: 6,
                status: 'completed',
                createdAt: new Date('2026-05-16T14:00:00.000Z').toISOString(),
              }}
              locale="en"
              onClose={() => setShowModal(false)}
            />
          )}
        </section>
        )}
      </div>
    </main>
  );
}
