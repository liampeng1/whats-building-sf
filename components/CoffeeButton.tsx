export function CoffeeButton() {
  return (
    <a
      href="https://buymeacoffee.com/liampeng"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-4 left-4 z-[1000] bg-paper border border-paper-edge rounded-md shadow-md px-3 py-2 text-xs text-ink-soft hover:text-ink hover:bg-amber-50 hover:border-amber-300 transition-colors flex items-center gap-1.5 font-medium"
      title="Tip the maker"
    >
      <span aria-hidden>☕</span>
      <span>Buy me a coffee</span>
    </a>
  )
}
