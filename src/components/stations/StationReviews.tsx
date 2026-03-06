import { useTranslations } from 'next-intl';
import type { Review } from '@/types/station';

interface StationReviewsProps {
  reviews: Review[];
}

/**
 * List of public reviews for a station.
 * Uses Tailwind dark: variants for theme support.
 */
export function StationReviews({ reviews }: StationReviewsProps) {
  const t = useTranslations('stations');

  if (reviews.length === 0) {
    return (
      <p className="text-[15px] text-[#333333] dark:text-[#C0C0B0] py-4">{t('detail_no_reviews')}</p>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="text-[15px] text-gold tracking-tight">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-[#C8C8B4] dark:bg-dark-card rounded-xl px-5 py-4 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-full bg-[#B0B0A0] dark:bg-tab-inactive flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[#666] dark:text-[#9A9A8A]">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#000C1F] dark:text-[#FFF8EC] truncate">{review.authorName}</p>
          <p className="text-[13px] text-[#333333] dark:text-[#C0C0B0]">{review.date}</p>
        </div>
        <StarRow rating={review.rating} />
      </div>
      {review.comment && (
        <p className="text-[15px] text-[#111111] dark:text-[#D8D8C8] leading-[1.7] mt-1.5">
          {review.comment}
        </p>
      )}
    </div>
  );
}
