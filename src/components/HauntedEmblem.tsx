export default function HauntedEmblem({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 2 44 14v20L24 46 4 34V14Z" stroke="currentColor" opacity=".6" />
      <path d="M24 7 39 16v16L24 41 9 32V16Z" stroke="currentColor" opacity=".25" />
      <path d="M30 13a12 12 0 1 0 5 20 13 13 0 0 1-5-20Z" fill="currentColor" />
      <path d="m32 21 1.5 3.5L37 26l-3.5 1.5L32 31l-1.5-3.5L27 26l3.5-1.5Z" fill="currentColor" />
    </svg>
  );
}
