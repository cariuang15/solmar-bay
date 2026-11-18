/* SOLMAR BAY — save: progress (money, missions done, position) in localStorage. */
(function () {
  'use strict';

  const KEY = 'solmar-bay-save-v1';

  function saveGame(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        money: Math.floor(state.money),
        missionsDone: state.missionsDone,
        px: state.px, pz: state.pz,
        storyDone: state.storyDone,
        savedAt: Date.now(),
      }));
      return true;
    } catch (e) { return false; }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (typeof d.money !== 'number' || typeof d.missionsDone !== 'number') return null;
      return d;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
  }

  SB.Save = { save: saveGame, load: loadGame, clear: clearSave, KEY: KEY };
})();
