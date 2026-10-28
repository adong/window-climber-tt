/* TT Window Climber in 中文: kid-friendly simplified Chinese. The boys' names and the game's English name stay as
   they are; the 中文 logo is WC.ZH (摩天楼攀爬). Loaded after js/keys.js. */
Kit.lang.keep(['TEDDY', 'TOMMY', 'FOXY', 'FROGGY', WC.TITLE, 'Teddy', 'Tommy']);
Kit.lang.add({
  // title
  'Climb the toy skyscrapers, window by window, up to the helicopter!': '一个窗户一个窗户往上爬，爬上玩具摩天楼，坐直升机！',
  PLAYERS: '人数',
  CLIMBER: '攀爬手',
  LEVEL: '难度',
  '1 PLAYER': '1 人',
  '2 PLAYERS': '2 人',
  'Foxy & Froggy cheer you on': '小狐狸和小青蛙给你加油',
  'race up two buildings side by side': '两栋楼并排比赛爬',
  'race up twin towers': '双子楼比赛爬',
  'boxing champ': '拳击冠军',
  'peace sign pro': '比耶高手',
  'slow windows · soft bonks · 5 lives': '窗户关得慢 · 砸得轻 · 5 条命',
  'quick windows · 3 lives': '窗户关得快 · 3 条命',
  '▶ CLIMB!': '▶ 开始爬！',
  'walk along the ledge': '沿着窗台走',
  'climb (open windows only)': '爬（只能爬开着的窗户）',
  'call your brother': '叫兄弟来帮忙',
  'pause · sound': '暂停 · 声音',
  or: '或',
  '◀ ▶ walk along the ledge, ▲ climbs through an open window. Tap your brother\'s face to call him!': '◀ ▶ 沿着窗台走，▲ 从开着的窗户往上爬。点兄弟的头像叫他来帮忙！',
  'built with': '制作工具',
  // HUD and touch
  'HI-SCORE': '最高分',
  BONUS: '奖励',
  'Pause (P)': '暂停 (P)',
  Pause: '暂停',
  'Sound (M)': '声音 (M)',
  'Sound on / off (M)': '声音 开 / 关 (M)',
  'Sound on or off': '声音 开或关',
  'Climb up': '往上爬',
  'Climb down': '往下爬',
  'Walk left': '往左走',
  'Walk right': '往右走',
  'High five': '击掌',
  CLIMB: '爬',
  CALL: '叫他',
  'ROOF!': '到楼顶啦！',
  'HIGH FIVE ✋': '击掌 ✋',
  // pause and results
  PAUSED: '暂停',
  '▶ RESUME': '▶ 继续',
  MENU: '菜单',
  'P · Esc · Space to go on · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
  "IT'S A TIE!": '平局！',
  'ALL 4 CLIMBED!': '4 栋楼全爬完啦！',
  'GREAT CLIMBING!': '爬得真棒！',
  '🐣 TOP CLIMBERS': '🐣 攀爬排行榜',
  '🔥 TOP CLIMBERS': '🔥 攀爬排行榜',
  '⭐ NEW HI-SCORE!': '⭐ 新纪录！',
  '⭐ ON THE BOARD!': '⭐ 上榜啦！',
  '↻ PLAY AGAIN': '↻ 再玩一次',
  'Enter: play again · Esc: menu': 'Enter 再玩一次 · Esc 回菜单',
  // play
  'READY?': '准备好了吗？',
  'GO!': '出发！',
  'TOP!': '到顶啦！',
  'GAME OVER': '游戏结束',
  'HELICOPTER RIDE!': '坐直升机咯！',
  'HEADS UP!': '小心头顶！',
  'WHOOPS! WHEEE!': '哎呀！滑下来啦！',
  'SHUT! WAIT OR MOVE OVER': '关上了！等一等或者换个窗户',
  'FLUMP!': '噗！',
  'BOING!': '嘣！',
  'SQUEAK!': '吱吱！',
  'BONK!': '咚！',
  'EXTRA LIFE!': '多一条命！',
  '+50 MISSED ME!': '+50 没砸到！',
  'HIGH FIVE! ✋ +50': '击掌！✋ +50',
  // buildings
  'CANDY TOWER': '糖果大楼',
  'MINT HEIGHTS': '薄荷大厦',
  'SUNNY SPIRE': '阳光尖塔',
  'STARRY SKYSCRAPER': '星星摩天楼',
  // ? panel
  'climb up or down (only through an open window)': '往上或往下爬（只能从开着的窗户爬）',
  'call your brother: he holds every window open (2 players: high five)': '叫兄弟来：他帮你把所有窗户都打开（2 人：击掌）',
  'title: 1 or 2 players · easy · normal · climber': '标题页：1 或 2 人 · 简单 · 普通 · 攀爬手',
  'In 1 player both sets of keys work. Climb only through the window with the green frame; a red frame means it is shut: wait, or move over. When a resident leans out and a shadow shows on the wall, step aside! Reach the roof and the helicopter flies you to the next building. Call your brother as often as you like.':
    '1 人时两组按键都能用。只能从绿框的窗户往上爬；红框表示窗户关了：等一等，或者换个窗户。有住户探出头、墙上出现影子时，快躲开！爬到楼顶，直升机会带你去下一栋楼。兄弟想叫几次就叫几次。',
  '◀ ▶ walk along the ledge, ▲ (or the big CLIMB button) climbs, ▼ climbs down, and your brother\'s face calls him. 2 players: a cross each, and ✋ for a high five.':
    '◀ ▶ 沿着窗台走，▲（或者大大的“爬”按钮）往上爬，▼ 往下爬，点兄弟的头像叫他来。2 人：每人一组方向键，✋ 是击掌。',
});
Kit.lang.rule(/^HI-SCORE ([\d,]+) · (.+)$/, '最高分 $1 · $2');
Kit.lang.rule(/^CALL (.+)$/, '叫 $1');
Kit.lang.rule(/^FLOOR (\d+) OF (\d+)$/, '第 $1 层 / 共 $2 层');
Kit.lang.rule(/^BUILDING (\d) OF 4$/, '第 $1 栋楼 / 共 4 栋');
Kit.lang.rule(/^(.+) · (\d)\/4$/, (m, name, n) => `${{ 'CANDY TOWER': '糖果大楼', 'MINT HEIGHTS': '薄荷大厦', 'SUNNY SPIRE': '阳光尖塔', 'STARRY SKYSCRAPER': '星星摩天楼' }[name] || name} · ${n}/4`);
Kit.lang.rule(/^BONUS \+([\d,]+)$/, '奖励 +$1');
Kit.lang.rule(/^TOP! \+([\d,]+)$/, '到顶啦！+$1');
Kit.lang.rule(/^(\S+) IS FIRST! \+2000$/, '$1 第一名！+2000');
Kit.lang.rule(/^(\S+) SAYS: I'LL HOLD THE WINDOWS!$/, '$1 说：窗户交给我！');
Kit.lang.rule(/^(\S+) WINS!$/, '$1 赢啦！');
Kit.lang.rule(/^([\d,]+) points · building (\d) of 4$/, '$1 分 · 第 $2 栋楼 / 共 4 栋');
Kit.lang.rule(/^(\S+) ([\d,]+) \((\d) 🏆\) · (\S+) ([\d,]+) \((\d) 🏆\)$/, '$1 $2 分（$3 🏆）· $4 $5 分（$6 🏆）');
Kit.lang.rule(/^(\S+) \+100$/, '$1 +100');
