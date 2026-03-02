export interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div>
      <span>Loading...</span>
      {label && <span> {label}</span>}
    </div>
  );
}

