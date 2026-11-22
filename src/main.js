import './style.css';
import { Game } from './game/game.js';
const game = new Game();
window.__game = game;
game.boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('load-text');
  if (t) t.textContent = 'Error: ' + e.message;
});
