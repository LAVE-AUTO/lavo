import { useTranslations } from 'next-intl';
import type { Review } from '@/types/station';

interface StationReviewsProps {
  reviews: Review[];
  dark?: boolean;
}

/**
 * List of public reviews for a station.
 * dark=true uses the dark card style matching the HTML mockup.
 */
export function StationReviews({ reviews, dark = false }: StationReviewsProps) {
  const t = useTranslations('stations');

  if (reviews.length === 0) {
    return (
      <p className="text-[13px] text-[#9A9A8A] py-4">{t('detail_no_reviews')}</p>
    );
  }

  return (
    <div className="space-y-2">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} dark={dark} />
      ))}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="text-[11px] text-gold tracking-tight">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

function ReviewCard({ review, dark }: { review: Review; dark: boolean }) {
  const cardBg  = dark ? 'bg-[#1E2A1A]' : 'bg-[#F5F5EE] dark:bg-[#1E2A1A]';
  const avatarBg = dark ? 'bg-[#3A4A36]' : 'bg-[#CCCCBB] dark:bg-[#3A4A36]';
  const nameCls  = dark ? 'text-white' : 'text-[#1A1A1A] dark:text-white';
  const textCls  = dark ? 'text-[#9A9A8A]' : 'text-[#555] dark:text-[#9A9A8A]';

  return (
    <div className={`${cardBg} rounded-xl px-3.5 py-3`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center shrink-0`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? '#9A9A8A' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-bold ${nameCls} truncate`}>{review.authorName}</p>
          <p className="text-[10px] text-[#9A9A8A]">{review.date}</p>
        </div>
        <StarRow rating={review.rating} />
      </div>
      {review.comment && (
        <p className={`text-[11px] ${textCls} leading-relaxed mt-1.5`}>
          {review.comment}
        </p>
      )}
    </div>
  );
}
