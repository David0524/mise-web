/* Hand-placed 16×16 grid sprites (original). One char = one cell; '.' = empty.
 * Default demo set is a kitchen; replace with the subject's own objects via PPM.defGrid.
 * Render flat with g.sprite(name, …) or as 3D blocks with g.block(name, …).
 */
(function () {
  const G = PPM.defGrid;
  const K = '#1c1717'; // shared outline ink

  G('tomato', [
    '................',
    '.......gG.......',
    '.....kgGGgk.....',
    '....krgGGgrk....',
    '...krrrggrrrk...',
    '..krhhrrrrrrrk..',
    '..krhrrrrrrrrk..',
    '.krhrrrrrrrrrrk.',
    '.krrrrrrrrrrrrk.',
    '.krrrrrrrrrrrdk.',
    '.krrrrrrrrrrddk.',
    '..krrrrrrrrddk..',
    '..kdrrrrrrdddk..',
    '...kdddddddk....',
    '....kkkkkkk.....',
    '................'], { k: K, r: '#D9261C', h: '#FF8A73', d: '#A3140F', g: '#3F8F3A', G: '#77C45A' });

  G('egg', [
    '................',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwwwwwwwwwwk..',
    '.kwwwwyyyywwwwk.',
    '.kwwwyYYyyywwwk.',
    'kwwwyYyyyyyywwwk',
    'kwwwyyyyyyyywwwk',
    'kwwwyyyyyyoywwwk',
    '.kwwwyyyyooywwk.',
    '.kwwwwyyyywwwssk',
    '..kwwwwwwwwwssk.',
    '...kwwwwwwwssk..',
    '....kkksswwkk...',
    '.......kkkk.....',
    '................'], { k: K, w: '#F4F0E6', s: '#D2CBBB', y: '#F2B417', Y: '#FFE48A', o: '#D98C0A' });

  G('pan', [
    '................',
    '................',
    '....kkkkkk......',
    '..kkmmmmmmkk....',
    '.kmGGGGGGGGmk...',
    '.kmGggggggGmk...',
    'kmGggggggggGmk..',
    'kmGggggggggGmkkkk',
    'kmGgggggggggmkbbbk',
    'kmGggggggggGmkkkkk',
    '.kmGggggggGmk...',
    '.kmmGGGGGGmmk...',
    '..kkmmmmmmkk....',
    '....kkkkkk......',
    '................',
    '................'], { k: K, m: '#5B5B63', G: '#3A3A42', g: '#2A2A30', b: '#8A5A2E' });

  G('whisk', [
    '.....kkkkkk.....',
    '....kwk..kwk....',
    '...kw.kwwk.wk...',
    '...kw.kwwk.wk...',
    '...kw.kwwk.wk...',
    '...kw.kwwk.wk...',
    '....kwkwwkwk....',
    '.....kwwwwk.....',
    '......kwwk......',
    '......kHHk......',
    '......kHHk......',
    '......kHHk......',
    '......kHHk......',
    '......kHhk......',
    '......kkkk......',
    '................'], { k: K, w: '#C9CCD3', H: '#D9201A', h: '#A3140F' });

  G('knife', [
    '..............kk',
    '.............kwk',
    '............kwsk',
    '...........kwsk.',
    '..........kwsk..',
    '.........kwsk...',
    '........kwsk....',
    '.......kwsk.....',
    '......kwwk......',
    '.....kkkk.......',
    '....kbbk........',
    '...kbBk.........',
    '..kbBk..........',
    '.kbBk...........',
    'kbbk............',
    'kkk.............'], { k: K, w: '#E3E6EC', s: '#9EA3AD', b: '#5A3A22', B: '#8A5A2E' });

  G('garlic', [
    '.......kk.......',
    '.......kgk......',
    '......kwwk......',
    '.....kwwwwk.....',
    '....kwwpwwwk....',
    '...kwwpwwwpwk...',
    '..kwwwpwwwpwwk..',
    '..kwwpwwwwwpwk..',
    '.kwwwpwwwwwpwwk.',
    '.kwwwpwwwwwpwsk.',
    '.kwwpwwwwwwwpsk.',
    '..kwwpwwwwwpsk..',
    '...kwwwwwwwssk..',
    '....kkssssskk...',
    '.....kkkkkkk....',
    '................'], { k: K, w: '#F2EDE2', p: '#C9A9D6', s: '#C9C1AE', g: '#7AA35A' });

  G('bread', [
    '................',
    '................',
    '....kkkkkkk.....',
    '..kkccccccckk...',
    '.kcCCcCCcCCcck..',
    'kccCcccCcccCcck.',
    'kcccccccccccccck',
    'kcccccccccccccck',
    'kccccccccccccdck',
    'kcccccccccccddck',
    'kdcccccccccdddck',
    '.kddddddddddddk.',
    '..kkkkkkkkkkkk..',
    '................',
    '................',
    '................'], { k: K, c: '#D99A4E', C: '#F2C48A', d: '#A86A2C' });

  G('pot', [
    '................',
    '.....s..s.......',
    '......s..s......',
    '.....s..s.......',
    '...kkkkkkkkkk...',
    'kkkrrrrrrrrrrkkk',
    'k.krRrrrrrrrrk.k',
    '..krRrrrrrrrrk..',
    '..krRrrrrrrrrk..',
    '..krrrrrrrrrdk..',
    '..krrrrrrrrrdk..',
    '..krrrrrrrrddk..',
    '...kddddddddk...',
    '....kkkkkkkk....',
    '................',
    '................'], { k: K, r: '#C9261C', R: '#FF7A66', d: '#8E1410', s: '#BDB7AD' });

  G('spoon', [
    '...........kkk..',
    '..........kwwwk.',
    '.........kwwWwwk',
    '.........kwWwwwk',
    '.........kwwwwsk',
    '..........kwssk.',
    '.........kwkkk..',
    '........kwk.....',
    '.......kwk......',
    '......kbk.......',
    '.....kbk........',
    '....kbk.........',
    '...kbk..........',
    '..kbk...........',
    '.kbk............',
    '.kk.............'], { k: K, w: '#C9CCD3', W: '#FFFFFF', s: '#8E929B', b: '#8A5A2E' });

  G('chili', [
    '............gg..',
    '...........gGk..',
    '..........kgk...',
    '.........krrk...',
    '........krhrk...',
    '.......krhrrk...',
    '......krhrrrk...',
    '.....krrrrrk....',
    '....krrrrrrk....',
    '...krrrrrrk.....',
    '..krrrrrdk......',
    '.krrrrddk.......',
    'krrdddkk........',
    'kddkk...........',
    'kk..............',
    '................'], { k: K, r: '#D9201A', h: '#FF8A73', d: '#9C130E', g: '#3F8F3A', G: '#77C45A' });

  G('lemon', [
    '................',
    '................',
    '.........gg.....',
    '.....kkkkgkk....',
    '...kkyyyyyyykk..',
    '..kyyYYyyyyyyyk.',
    '.kyyYyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyydk',
    '.kyyyyyyyyyyydk.',
    '..kyyyyyyyyddk..',
    '...kkdddddkk....',
    '.....kkkkk......',
    '................',
    '................',
    '................'], { k: K, y: '#F2D22E', Y: '#FFF2A0', d: '#C9A515', g: '#3F8F3A' });

  G('cup', [
    '....s...s.......',
    '.....s...s......',
    '....s...s.......',
    '................',
    '..kkkkkkkkkk....',
    '..kwwwwwwwwk....',
    '..kcccccccckkk..',
    '..kwwwwwwwwk.k..',
    '..kwwwwwwwwk.k..',
    '..kwwwwwwwwkkk..',
    '..kwwwwwwwsk....',
    '...kwwwwwsk.....',
    'kkkkkkkkkkkkkkk.',
    '.kssssssssssk...',
    '..kkkkkkkkkk....',
    '................'], { k: K, w: '#F2EEE6', s: '#C9C1AE', c: '#6B3E1E' });

  G('heart', [
    '................',
    '..kkkk....kkkk..',
    '.krrrrk..krrrrk.',
    'krhhrrrkkrrrrrrk',
    'krhrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrrk',
    '.krrrrrrrrrrrdk.',
    '..krrrrrrrrrdk..',
    '...krrrrrrrdk...',
    '....krrrrrdk....',
    '.....krrrdk.....',
    '......krdk......',
    '.......kk.......',
    '................',
    '................'], { k: '#5a0a0c', r: '#D61F1F', h: '#FF9A80', d: '#A8121A' });

  PPM.KITCHEN_SET = ['tomato', 'egg', 'pan', 'whisk', 'knife', 'garlic', 'bread', 'pot', 'spoon', 'chili', 'lemon', 'cup'];
})();
