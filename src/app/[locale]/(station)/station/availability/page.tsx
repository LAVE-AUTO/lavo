// Disponibilité — gestion des blocs de disponibilité de la station
// TODO: connect to API once /station/availability-blocks endpoint is available
// See folder/spec/backend-missing-endpoints.md — section 3.10
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BlocksPanel } from '@/components/station/availability/BlocksPanel';
import { MonthCalendar } from '@/components/station/availability/MonthCalendar';
import { CreateBlockModal } from '@/components/station/availability/CreateBlockModal';
import { DayDetailsModal } from '@/components/station/availability/DayDetailsModal';
import type { AvailabilityBlock } from '@/components/station/availability/types';

// TODO: replace with data from GET /station/availability-blocks
const INITIAL_BLOCKS: AvailabilityBlock[] = [];

let nextId = 1;
function generateId(): string {
  return `local-${nextId++}`;
}

export default function StationAvailabilityPage() {
  const t = useTranslations('station_dashboard');

  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(INITIAL_BLOCKS);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Create / Edit modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);

  // Day details modal
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);

  function getBlocksForDate(dateISO: string): AvailabilityBlock[] {
    return blocks.filter((b) => b.dates.includes(dateISO));
  }

  function handleDayClick(dateISO: string) {
    setSelectedDay(dateISO);
    setIsDayModalOpen(true);
  }

  function openCreateModal() {
    setEditingBlock(null);
    setPreselectedDate(null);
    setIsCreateOpen(true);
  }

  function openCreateForDay(dateISO: string) {
    setEditingBlock(null);
    setPreselectedDate(dateISO);
    setIsCreateOpen(true);
  }

  function openEditModal(block: AvailabilityBlock) {
    setEditingBlock(block);
    setPreselectedDate(null);
    setIsCreateOpen(true);
  }

  function handleSave(data: Omit<AvailabilityBlock, 'id'>) {
    // TODO: call POST /station/availability-blocks or PATCH /station/availability-blocks/:id
    if (editingBlock) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === editingBlock.id ? { ...data, id: editingBlock.id } : b)),
      );
    } else {
      setBlocks((prev) => [...prev, { ...data, id: generateId() }]);
    }
    setEditingBlock(null);
  }

  function handleDelete(id: string) {
    // TODO: call DELETE /station/availability-blocks/:id
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-[#C09A18]/20 px-6 py-4 dark:border-[#C09A18]/10">
        <h1 className="text-2xl font-black text-[#1A1A0A] dark:text-[#F0EDD4]">
          {t('availability_title')}
        </h1>
        <p className="mt-0.5 text-sm text-[#666] dark:text-[#A0A090]">
          {t('availability_subtitle')}
        </p>
      </div>

      {/* Main two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        <BlocksPanel
          blocks={blocks}
          onDelete={handleDelete}
          onEdit={openEditModal}
          onCreateClick={openCreateModal}
        />
        <MonthCalendar
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          getBlocksForDate={getBlocksForDate}
          onDayClick={handleDayClick}
          selectedDateISO={selectedDay}
        />
      </div>

      {/* Modals */}
      <CreateBlockModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingBlock(null);
          setPreselectedDate(null);
        }}
        onSave={handleSave}
        editingBlock={editingBlock}
        preselectedDate={preselectedDate}
      />
      <DayDetailsModal
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        date={selectedDay}
        blocks={selectedDay ? getBlocksForDate(selectedDay) : []}
        onDeleteBlock={handleDelete}
        onEditBlock={openEditModal}
        onCreateForDay={openCreateForDay}
      />
    </div>
  );
}
