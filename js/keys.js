/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: WC.TITLE, // the name lives in js/title.js
  cols: ['Teddy', 'Tommy'],
  keys: [
    ['walk along the ledge', 'A D', '← →'],
    ['climb up or down (only through an open window)', 'W S', '↑ ↓'],
    ['call your brother: he holds every window open (2 players: high five)', 'T', 'T'],
    ['pause · sound', 'P or Esc · M', 'P or Esc · M'],
    ['title: 1 or 2 players · easy · normal · climber', '1 2 · E · N · C', ''],
  ],
  note: 'In 1 player both sets of keys work. Climb only through the window with the green frame; a red frame means it is shut: wait, or move over. When a resident leans out and a shadow shows on the wall, step aside! Reach the roof and the helicopter flies you to the next building. Call your brother as often as you like.',
  touch: '◀ ▶ walk along the ledge, ▲ (or the big CLIMB button) climbs, ▼ climbs down, and your brother\'s face calls him. 2 players: a cross each, and ✋ for a high five.',
});
