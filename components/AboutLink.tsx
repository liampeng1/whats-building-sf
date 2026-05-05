import Link from 'next/link'

export function AboutLink() {
  return (
    <Link
      href="/about"
      className="absolute bottom-[60px] left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-md px-3 py-2 text-xs text-ink-soft hover:text-ink hover:bg-paper-deep hover:border-ink transition-colors flex items-center gap-1.5 font-medium"
      title="About this project — methodology and sources"
    >
      <span aria-hidden>ⓘ</span>
      <span>About</span>
    </Link>
  )
}
