/* Original procedural pixel-art sprites for paper-pixel-motion.
 * Each draws on a tiny grid (≈24–40 px). The engine thresholds alpha, adds a 1-px
 * dark outline and scales with nearest-neighbour. No brand marks, ever.
 * Add your own with PPM.defSprite(name, gridW, gridH, ({x, px, circ, poly, shade}) => {...}).
 */
(function () {
  const D = PPM.defSprite;

  D('camera', 34, 22, ({ px, circ }) => {
    px(0, 4, 34, 18, '#9a9a9e'); px(0, 4, 34, 3, '#c9c9cc'); px(0, 18, 34, 4, '#5d5d63');      // body, top light, base shade
    px(0, 8, 34, 9, '#3a3a40');                                                               // leatherette band
    px(3, 1, 8, 4, '#7b7b81'); px(24, 1, 6, 3, '#7b7b81'); px(25, 2, 4, 1, '#2c2c30');          // dials / viewfinder
    px(26, 6, 5, 3, '#1c1c20'); px(27, 6, 2, 1, '#e8e8ea');                                    // finder window
    circ(17, 13, 8, '#2a2a2e'); circ(17, 13, 6, '#6f6f76'); circ(17, 13, 4, '#1b1b1f'); circ(17, 13, 2, '#3d4a66');
    px(15, 11, 2, 1, '#e9eef7'); px(5, 6, 2, 2, '#c8261c');                                    // lens glint, red dot
  });

  D('vinyl', 28, 28, ({ circ, px }) => {
    circ(14, 14, 13, '#232536'); circ(14, 14, 11, '#2d3044'); circ(14, 14, 9, '#232536');
    px(5, 6, 3, 3, '#6d6a88'); px(4, 9, 2, 3, '#6d6a88'); px(20, 19, 3, 3, '#6d6a88'); px(22, 16, 2, 3, '#6d6a88'); // sheen
    circ(14, 14, 4, '#d62a24'); px(14, 14, 1, 1, '#f3e9e4'); px(12, 12, 1, 1, '#ff7469');
  });

  D('book', 30, 22, ({ px, poly }) => {
    poly([[2, 4], [24, 0], [28, 16], [6, 21]], '#a3241f');      // cover
    poly([[6, 21], [28, 16], [29, 19], [7, 22]], '#f1e7cf');    // page block
    poly([[2, 4], [6, 21], [4, 22], [0, 6]], '#6e1512');        // spine
    poly([[9, 6], [19, 4], [21, 10], [11, 12]], '#8c9a4f');     // label
    px(23, 17, 2, 1, '#d24a9a'); px(20, 18, 2, 1, '#69c34f'); px(5, 9, 1, 8, '#c9a35b'); // bookmark threads, spine band
  });

  D('clapper', 28, 26, ({ px, poly }) => {
    px(1, 10, 26, 15, '#283a8f'); px(1, 10, 26, 2, '#3f55c0');
    px(4, 15, 6, 3, '#c7d0f2'); px(12, 15, 6, 3, '#c7d0f2'); px(20, 15, 5, 3, '#c7d0f2'); px(4, 20, 21, 2, '#9aa6dc');
    poly([[1, 9], [25, 2], [27, 7], [3, 13]], '#ece9f2');
    for (let i = 0; i < 4; i++) poly([[4 + i * 6, 8 - i * 1.6], [8 + i * 6, 7 - i * 1.6], [10 + i * 6, 11 - i * 1.6], [6 + i * 6, 12 - i * 1.6]], '#3443a8');
  });

  D('plant', 26, 30, ({ px, poly, circ }) => {
    poly([[6, 19], [20, 19], [18, 29], [8, 29]], '#9fb4d9'); px(5, 18, 16, 3, '#c5d4ee'); px(8, 24, 2, 4, '#7c90b8');
    const leaf = (x, y, c) => { circ(x, y, 3, c); };
    [[13, 6, '#3f8f3a'], [8, 9, '#57a845'], [18, 9, '#57a845'], [5, 13, '#3f8f3a'], [21, 13, '#3f8f3a'], [11, 12, '#77c45a'], [16, 14, '#57a845'], [13, 2, '#77c45a']].forEach(([x, y, c]) => leaf(x, y, c));
    px(12, 12, 2, 7, '#2e6a2b'); px(9, 7, 1, 1, '#a7e07f'); px(19, 10, 1, 1, '#a7e07f');
  });

  D('cash', 34, 20, ({ poly, px }) => {
    poly([[0, 7], [26, 0], [34, 12], [8, 20]], '#3f8f35');
    poly([[0, 5], [26, -2], [33, 9], [7, 17]], '#69bf4d');
    poly([[12, 2], [17, 1], [22, 13], [17, 14]], '#d8c79a');                  // paper band
    px(6, 8, 2, 3, '#2f6e29'); px(26, 4, 2, 3, '#2f6e29'); px(5, 8, 1, 1, '#9be27a');
  });

  D('heart', 26, 24, ({ px }) => {
    const rows = ['  XXXXX     XXXXX  ', ' XXXXXXX   XXXXXXX ', 'XXXXXXXXX XXXXXXXXX', 'XXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXX', ' XXXXXXXXXXXXXXXXX ', '  XXXXXXXXXXXXXXX  ', '   XXXXXXXXXXXXX   ', '    XXXXXXXXXXX    ', '     XXXXXXXXX     ', '      XXXXXXX      ', '       XXXXX       ', '        XXX        ', '         X         '];
    const s = 26 / 19;
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'X') px(x * s, y * s * 1.15, s + .5, s * 1.15 + .5, '#d61f1f'); }));
    px(3, 2, 6, 6, '#f07a4a'); px(4, 3, 3, 3, '#ffb08a'); px(18, 14, 4, 3, '#a8121a');
  }, { outline: '#7a0d10' });

  D('coin', 24, 28, ({ circ, px }) => {
    circ(12, 14, 11, '#1a1610'); circ(12, 14, 10, '#e5b923'); circ(12, 14, 7, '#c99512');
    px(9, 7, 6, 14, '#1a1610'); px(10, 8, 4, 12, '#f6dc5c'); px(5, 6, 2, 3, '#fff3b0');
  }, { outline: '#120f0a' });

  D('controller', 36, 20, ({ px, circ }) => {
    circ(7, 11, 7, '#ecebe6'); circ(29, 11, 7, '#ecebe6'); px(7, 4, 22, 13, '#ecebe6'); px(7, 15, 22, 2, '#c9c7bf');
    px(4, 10, 6, 2, '#1d1b1b'); px(6, 8, 2, 6, '#1d1b1b');                                   // d-pad
    px(13, 10, 3, 1, '#1d1b1b'); px(18, 10, 3, 1, '#1d1b1b');                                 // select/start
    px(28, 7, 2, 2, '#2f6ee0'); px(31, 10, 2, 2, '#e34234'); px(25, 10, 2, 2, '#f2c12e'); px(28, 13, 2, 2, '#36b24a');
  });

  D('cap', 32, 20, ({ poly, px }) => {
    poly([[4, 12], [8, 3], [16, 0], [24, 3], [27, 12]], '#efeadb');      // crown
    poly([[4, 12], [27, 12], [31, 16], [2, 17]], '#d9d2bd');             // band
    poly([[14, 13], [31, 13], [32, 19], [12, 19]], '#f6f2e6');           // brim (towards camera)
    px(15, 1, 2, 1, '#bdb59d'); px(10, 6, 1, 5, '#cfc7ae'); px(20, 5, 1, 6, '#cfc7ae');
  });

  D('skateboard', 38, 14, ({ poly, px, circ }) => {
    poly([[2, 4], [5, 1], [33, 1], [36, 4], [33, 8], [5, 8]], '#2a2727'); px(6, 2, 26, 1, '#4a4545');
    for (let i = 0; i < 7; i++) px(8 + i * 4, 4, 1, 1, '#6c6666');
    circ(9, 11, 2, '#c82b22'); circ(29, 11, 2, '#c82b22'); px(7, 8, 5, 1, '#8b8b8b'); px(27, 8, 5, 1, '#8b8b8b');
  });

  D('cat', 26, 26, ({ poly, px, circ }) => {
    circ(10, 9, 6, '#161414'); poly([[4, 6], [5, 0], [9, 4]], '#161414'); poly([[11, 4], [15, 0], [16, 6]], '#161414'); // head + ears
    poly([[8, 12], [20, 13], [24, 22], [22, 25], [6, 25], [5, 18]], '#161414');                                    // body
    poly([[21, 20], [25, 9], [26, 10], [23, 22]], '#161414');                                                       // tail
    px(7, 8, 2, 1, '#e8d84a'); px(12, 8, 2, 1, '#e8d84a'); px(6, 13, 1, 1, '#3a3434');
  }, { outline: '#0b0a0a' });

  D('note', 16, 26, ({ px, circ }) => { circ(5, 21, 4, '#d9201a'); px(8, 2, 2, 20, '#d9201a'); px(9, 2, 5, 3, '#d9201a'); px(12, 5, 3, 4, '#d9201a'); }, { outline: false });
  D('notes2', 26, 26, ({ px, circ }) => { circ(5, 21, 4, '#d9201a'); circ(19, 18, 4, '#d9201a'); px(8, 3, 2, 19, '#d9201a'); px(22, 1, 2, 18, '#d9201a'); px(8, 1, 16, 4, '#d9201a'); px(8, 6, 16, 2, '#d9201a'); }, { outline: false });

  D('mug', 26, 24, ({ px, circ }) => {
    px(3, 5, 16, 18, '#e9e4da'); px(3, 5, 16, 3, '#ffffff'); px(15, 8, 4, 15, '#cbc4b6');
    circ(21, 13, 5, '#e9e4da'); circ(21, 13, 2, '#00000000'); px(20, 12, 3, 3, '#2a2626');
    px(4, 5, 14, 2, '#5b3a22'); px(7, 0, 1, 3, '#bdb7ad'); px(11, 1, 1, 3, '#bdb7ad');
  });

  D('headphones', 30, 26, ({ px, x }) => {
    x.strokeStyle = '#2a2a33'; x.lineWidth = 3; x.beginPath(); x.arc(15, 15, 11, Math.PI, 0); x.stroke();
    px(1, 13, 6, 11, '#2a2a33'); px(23, 13, 6, 11, '#2a2a33'); px(2, 15, 4, 7, '#d9201a'); px(24, 15, 4, 7, '#d9201a'); px(3, 16, 1, 3, '#ff8a80');
  });

  D('star', 24, 24, ({ poly, px }) => { poly([[12, 0], [15, 8], [24, 9], [17, 15], [19, 24], [12, 19], [5, 24], [7, 15], [0, 9], [9, 8]], '#f2c12e'); px(10, 7, 3, 3, '#fff1a8'); });

  D('sneaker', 34, 18, ({ poly, px }) => {
    poly([[1, 10], [4, 3], [12, 2], [18, 7], [30, 9], [33, 13], [33, 15], [1, 15]], '#ecebe6');
    px(1, 14, 33, 3, '#c8c4b8'); px(6, 5, 7, 1, '#d9201a'); px(14, 6, 1, 4, '#9c9890'); px(17, 8, 1, 4, '#9c9890');
  });

  // Names grouped for quick sets
  PPM.SPRITE_SET = ['camera', 'vinyl', 'book', 'clapper', 'plant', 'cash', 'heart', 'coin', 'controller', 'cap', 'skateboard', 'cat', 'mug', 'headphones', 'star', 'sneaker'];
})();
