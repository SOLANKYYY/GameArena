/** Bring the board into view when a player starts from the controls below it. */
export function showGameBoard() {
  if (window.matchMedia('(max-width: 768px)').matches) {
    document.getElementById('game-board')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
}
