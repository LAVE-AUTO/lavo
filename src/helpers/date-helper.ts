/**
 * Formats date to readable string.
 *
 * @param date - The date to format
 * @param format - Format type: 'short', 'long', 'iso'
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: 'short' | 'long' | 'iso' = 'long'
): string {
  if (!date) return '';
  const d = new Date(date);

  if (format === 'short') {
    return d.toLocaleDateString('fr-FR', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (format === 'long') {
    return d.toLocaleDateString('fr-FR', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (format === 'iso') {
    return d.toISOString().split('T')[0] ?? '';
  }

  return d.toLocaleDateString();
}

/**
 * Gets relative time string (e.g., "2 days ago").
 *
 * @param date - The date to compare
 * @returns Relative time string
 */
export function getRelativeTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  return 'À l\'instant';
}
