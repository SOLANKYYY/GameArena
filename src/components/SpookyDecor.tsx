// Atmospheric decoration never captures input.
export default function SpookyDecor() {
  return (
    <div className="spooky-decor" aria-hidden="true">
      <div className="haunt-mist haunt-mist-one" />
      <div className="haunt-mist haunt-mist-two" />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <span key={i} className="haunt-ember" style={{ left: (12 + i * 16) + '%', animationDelay: (i * -3) + 's' }} />
      ))}
      <svg className="web web-l" viewBox="0 0 120 120"><g stroke="currentColor" fill="none">
        <path d="M0 0H120M0 0V120M0 0L110 60M0 0L60 110M0 0L120 30M0 0L30 120" />
        <path d="M30 0Q25 25 0 30M60 0Q50 50 0 60M90 0Q75 75 0 90M120 0Q100 100 0 120" />
      </g></svg>
    </div>
  );
}
