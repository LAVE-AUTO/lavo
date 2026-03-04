import { useTranslations } from 'next-intl';
import { StarRating } from '@/components/ratings/StarRating';
import type { Review } from '@/types/station';

interface StationReviewsProps {
  reviews: Review[];
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/**
 * List of public reviews for a station.
 * Shows author avatar placeholder, name, star rating, date, and comment.
 */
export function StationReviews({ reviews }: StationReviewsProps) {
  const t = useTranslations('stations');

  if (reviews.length === 0) {
    return (
      <p className="text-[13px] text-lavo-muted py-4">{t('detail_no_reviews')}</p>
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

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-[#F5F5EE] dark:bg-dark-card rounded-xl p-4 border border-[#EBEBDF] dark:border-[#2C3828]">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-[#CCCCBB] dark:bg-[#3A4A36] flex items-center justify-center text-lavo-muted shrink-0">
          <UserIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#1A1A1A] dark:text-white truncate">
            {review.authorName}
          </p>
          <p className="text-[11px] text-lavo-muted">{review.date}</p>
        </div>
        <StarRating value={review.rating} size="sm" />
      </div>
      {review.comment && (
        <p className="text-[12px] text-[#555] dark:text-lavo-muted leading-relaxed">
          {review.comment}
        </p>
      )}
    </div>
  );
}
