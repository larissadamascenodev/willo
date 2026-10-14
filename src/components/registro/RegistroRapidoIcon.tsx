/**
 * The mark for Registro rápido: something said, and said fast.
 *
 * It replaces the scan brackets on the add button, which promised a camera and now
 * opens a conversation. A bubble says "tell me"; the bolt inside says how long it
 * takes. Drawn at lucide's weight and box so it sits in the same row as the rest
 * without looking borrowed, with the bolt filled because a stroked one at 25px turns
 * into a smudge.
 */
export default function RegistroRapidoIcon({ className, strokeWidth = 2 }: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 4h12a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6l-5 4v-4H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
      <path
        d="M13.25 6.9 9.5 11.45h2.4l-1.15 3.15 3.75-4.55h-2.4z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
