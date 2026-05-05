/**
 * Brand mark — navy circle with cream "rising bars" inside, the same shape
 * used in the construction stage glyph (recolored to ink so it reads as a
 * brand element, not a stage indicator). Two variants for use against
 * paper or ink backgrounds.
 */
export function Logo({
  size = 24,
  variant = 'on-paper',
  className,
}: {
  size?: number
  variant?: 'on-paper' | 'on-ink'
  className?: string
}) {
  const bg = variant === 'on-ink' ? '#fbf6ec' : '#1c2438'
  const fg = variant === 'on-ink' ? '#1c2438' : '#fbf6ec'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill={bg} />
      <rect x="6" y="12" width="2.6" height="5.5" fill={fg} />
      <rect x="10.7" y="9.5" width="2.6" height="8" fill={fg} />
      <rect x="15.4" y="7" width="2.6" height="10.5" fill={fg} />
    </svg>
  )
}
