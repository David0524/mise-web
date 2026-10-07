/* Extra hand-placed 16×16 sprites for the Mise launch film (original). */
(function () {
  const G = PPM.defGrid, K = '#1c1717';

  G('board', [  // paddle cutting board, handle on the right with a hanging hole, grain streaks
    '................',
    '................',
    '................',
    'kkkkkkkkkkk.....',
    'kwWWwwwwwwkkkkk.',
    'kwwwwdddwwwwwwwk',
    'kwwwwwwwwwwwkwwk',
    'kwdddwwwwwwwwwwk',
    'kwwwwwwwwddwkkkk',
    'kwwwwwwwwwwk....',
    'kwwwddddwwwk....',
    'kkkkkkkkkkkk....',
    '................',
    '................',
    '................',
    '................'], { k: K, w: '#E2B57A', W: '#F4D3A0', d: '#B98549' });

  G('bowl', [
    '................',
    '................',
    '................',
    '................',
    '....gg..rr......',
    '...gGgrrRrr.....',
    '.kkkkkkkkkkkkkk.',
    'kwWwwwwwwwwwwwsk',
    'kwwwwwwwwwwwwwsk',
    '.kwwwwwwwwwwwsk.',
    '..kwwwwwwwwwsk..',
    '...kkwwwwwwkk...',
    '.....kkkkkk.....',
    '................',
    '................',
    '................'], { k: K, w: '#F2EEE6', W: '#FFFFFF', s: '#C9C1AE', g: '#57A845', G: '#77C45A', r: '#D9261C', R: '#FF7A66' });

  G('timer', [
    '.......kk.......',
    '......kRRk......',
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrRrrrrrrrk..',
    '.krrwwwwwwwwrrk.',
    '.krwwwwkwwwwwrk.',
    'krrwwwwkwwwwwrrk',
    'krrwwwwkkkkwwrrk',
    'krrwwwwwwwwwwrrk',
    '.krwwwwwwwwwwrk.',
    '.krrwwwwwwwwrrk.',
    '..krrrrrrrrrdk..',
    '...kkddddddkk...',
    '.....kkkkkk.....',
    '................'], { k: K, r: '#D9261C', R: '#FF8A73', d: '#9C130E', w: '#F4F0E6' });

  G('salt', [
    '.....kkkkkk.....',
    '....kmmmmmmk....',
    '....kmhmhmmk....',
    '....kkkkkkkk....',
    '....kwwwwwwk....',
    '...kwWwwwwwsk...',
    '...kwwwwwwwsk...',
    '...kwwwwwwwsk...',
    '...kwwwwwwwsk...',
    '...kwwwwwwwsk...',
    '...kwwwwwwwsk...',
    '...kwwwwwwssk...',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................'], { k: K, m: '#9EA3AD', h: '#5E636B', w: '#F2EEE6', W: '#FFFFFF', s: '#C9C1AE' });

  G('recipe', [
    '................',
    '..kkkkkkkkkkk...',
    '..kwwwwwwwwwwk..',
    '..kwrrrrrwwwwk..',
    '..kwwwwwwwwwwk..',
    '..kwllllllllwk..',
    '..kwwwwwwwwwwk..',
    '..kwlllllllwwk..',
    '..kwwwwwwwwwwk..',
    '..kwllllllwwwk..',
    '..kwwwwwwwwwwk..',
    '..kwlllllllwwk..',
    '..kwwwwwwwwwsk..',
    '..kkkkkkkkkkkk..',
    '................',
    '................'], { k: K, w: '#F6F1E4', r: '#D9261C', l: '#9C9488', s: '#D8CFBC' });

  window.MISE_SET = ['knife', 'board', 'bowl', 'garlic', 'lemon', 'tomato', 'egg', 'pan', 'spoon', 'salt', 'recipe', 'timer'];
})();
