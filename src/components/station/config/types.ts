export interface StationConfig {
  id: string;
  opening_time: string | null;
  closing_time: string | null;
  break_start: string | null;
  break_end: string | null;
  wash_duration_minutes: number | null;
  wash_post_count: number | null;
  late_tolerance_minutes: number | null;
  cancellation_delay_minutes: number | null;
  max_concurrent_posts: number | null;
  margin_before_minutes: number | null;
  margin_after_minutes: number | null;
  reservation_surcharge: string | null;
}

export interface StationPost {
  id: string;
  position: number;
  is_active: boolean;
}
