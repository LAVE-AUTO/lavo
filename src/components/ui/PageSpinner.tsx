/**
 * Full-width centered gold spinner for page-level and section-level loading states.
 *
 * @param py    - Vertical padding utility class applied to the wrapper (default: 'py-32')
 * @param label - Accessible label for screen readers (default: 'Loading')
 */
export function PageSpinner({
  py = 'py-32',
  label = 'Loading',
}: {
  py?: string;
  label?: string;
}) {
  return (
    <div className={`flex justify-center items-center ${py}`} role="status" aria-label={label}>
      <div className="w-8 h-8 border-[3px] border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
