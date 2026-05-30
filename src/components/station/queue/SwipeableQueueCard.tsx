'use client';

import { ReactNode, useRef, useState, useCallback } from 'react';

interface SwipeableQueueCardProps {
  entryId: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: ReactNode;
}

const SWIPE_THRESHOLD = 50; // pixels

export function SwipeableQueueCard({ entryId, onSwipeLeft, onSwipeRight, children }: SwipeableQueueCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const [translateX, setTranslateX] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;
    setTranslateX(diff * 0.3); // Dampen the movement
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const currentX = e.changedTouches[0].clientX;
      const diff = currentX - startXRef.current;

      if (diff < -SWIPE_THRESHOLD) {
        // Swiped left
        onSwipeLeft();
      } else if (diff > SWIPE_THRESHOLD) {
        // Swiped right
        onSwipeRight();
      }

      setTranslateX(0);
    },
    [onSwipeLeft, onSwipeRight]
  );

  return (
    <div
      ref={cardRef}
      className="touch-pan-y select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateX(${translateX}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
