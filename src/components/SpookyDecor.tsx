// Purely decorative Halloween overlay (cobwebs, bats, blood drips, floating ghosts).
export default function SpookyDecor() {
  return (
    <div className="spooky-decor" aria-hidden="true">
      <svg className="web web-l" viewBox="0 0 120 120"><g stroke="currentColor" fill="none" strokeWidth="1">
        <path d="M0 0L120 0M0 0L0 120M0 0L110 60M0 0L60 110M0 0L120 30M0 0L30 120"/>
        <path d="M30 0Q25 25 0 30M60 0Q50 50 0 60M90 0Q75 75 0 90"/></g></svg>
      <svg className="web web-r" viewBox="0 0 120 120"><g stroke="currentColor" fill="none" strokeWidth="1">
        <path d="M0 0L120 0M0 0L0 120M0 0L110 60M0 0L60 110M0 0L120 30M0 0L30 120"/>
        <path d="M30 0Q25 25 0 30M60 0Q50 50 0 60M90 0Q75 75 0 90"/></g></svg>
      <div className="blood-drips">{Array.from({ length: 9 }).map((_, i) => <span key={i} style={{ left: `${6 + i * 11}%`, animationDelay: `${i * 0.7}s`, height: `${14 + (i % 4) * 9}px` }} />)}</div>
      {[0, 1, 2].map(i => <span key={i} className={`bat bat-${i}`}>🦇</span>)}
      <span className="ghost ghost-0">👻</span>
      <span className="ghost ghost-1">👻</span>
    </div>
  );
}
