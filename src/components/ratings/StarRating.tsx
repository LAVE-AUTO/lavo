export interface StarRatingProps {
  value?: number;
}

export function StarRating({ value = 0 }: StarRatingProps) {
  return <div>Note: {value}/5</div>;
}

