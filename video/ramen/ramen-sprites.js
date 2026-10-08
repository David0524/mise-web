/* Original pixel objects for the 3 a.m. ramen film (procedural sprites: a tiny grid, auto 1-px outline). */
(function () {
  const D = PPM.defSprite;

  D('ramen', 24, 20, ({ px, poly, circ }) => {
    poly([[17, 0], [19, 0], [13, 9], [11, 9]], '#D9A86C'); poly([[20, 1], [22, 1], [15, 9], [13, 9]], '#B8854A');   // chopsticks
    px(1, 7, 22, 3, '#C98B4A');                                     // broth surface
    px(2, 8, 4, 1, '#F2D27A'); px(9, 9, 6, 1, '#F2D27A'); px(17, 8, 4, 1, '#F2D27A'); // noodles breaking the surface
    poly([[3, 7], [5, 2], [8, 2], [8, 8]], '#1F3B2A'); px(5, 3, 2, 3, '#2F5A3E');      // nori, standing
    circ(13, 7, 2, '#F7F3E8'); px(12, 6, 2, 2, '#F29A1E'); px(13, 6, 1, 1, '#FFC24A'); // ajitama half
    px(17, 6, 2, 1, '#5DA83A'); px(19, 7, 2, 1, '#9AD66B'); px(9, 7, 1, 1, '#5DA83A'); // scallion
    poly([[0, 10], [24, 10], [21, 17], [3, 17]], '#C9301F');        // bowl
    px(2, 11, 20, 1, '#E04A35'); for (let i = 0; i < 6; i++) px(4 + i * 3, 13, 2, 1, '#F7F3E8'); // rim light, pattern
    poly([[4, 16], [20, 16], [19, 17], [5, 17]], '#8E1F14'); px(8, 17, 8, 2, '#8E1F14');           // shade + foot
  });

  D('moon', 20, 20, ({ circ, x, px }) => {
    circ(9, 10, 8, '#F4E6B8'); circ(7, 8, 2, '#E3CF92'); circ(11, 14, 1, '#E3CF92');
    x.globalCompositeOperation = 'destination-out'; circ(14, 7, 7, '#000'); x.globalCompositeOperation = 'source-over';
    px(16, 14, 1, 3, '#F4E6B8'); px(15, 15, 3, 1, '#F4E6B8'); px(17, 3, 1, 1, '#F4E6B8');       // stars
  });

  D('clock', 20, 22, ({ circ, px }) => {
    circ(4, 3, 3, '#C9301F'); circ(15, 3, 3, '#C9301F');              // bells
    circ(10, 11, 9, '#C9301F'); circ(10, 11, 7, '#F7F3E8');
    px(10, 5, 1, 7, '#1c1717'); px(10, 11, 5, 1, '#1c1717');           // 3:00
    px(10, 3, 1, 1, '#8E1F14'); px(17, 11, 1, 1, '#8E1F14'); px(3, 11, 1, 1, '#8E1F14'); px(10, 18, 1, 1, '#8E1F14');
    px(4, 19, 2, 3, '#8E1F14'); px(14, 19, 2, 3, '#8E1F14');           // feet
  });

  D('bulb', 16, 22, ({ circ, px }) => {
    circ(8, 7, 7, '#FFE58A'); circ(6, 5, 2, '#FFF6CF'); px(5, 12, 6, 2, '#FFE58A');
    px(7, 7, 1, 5, '#E89B2A'); px(9, 7, 1, 5, '#E89B2A'); px(7, 7, 3, 1, '#E89B2A');   // filament
    px(5, 14, 6, 2, '#9A9899'); px(5, 16, 6, 1, '#6E6C6E'); px(5, 17, 6, 2, '#9A9899'); px(6, 19, 4, 2, '#6E6C6E');
  });

  D('noodles', 22, 16, ({ px }) => {
    const Y = ['#F2D27A', '#E2B85A', '#F8E2A0'];
    for (let r = 0; r < 6; r++) for (let i = 0; i < 20; i++) { const y = 3 + r * 2 + Math.round(Math.sin(i * .9 + r * 1.7) * 1.2); px(1 + i, y, 1, 2, Y[(r + (i > 10 ? 1 : 0)) % 3]); }
    px(0, 6, 1, 6, '#E2B85A'); px(21, 5, 1, 7, '#E2B85A');
  });

  D('soy', 12, 24, ({ px, poly }) => {
    px(4, 0, 4, 3, '#C9301F'); px(3, 3, 6, 2, '#C9301F'); px(4, 3, 1, 1, '#E04A35');        // cap
    poly([[3, 5], [9, 5], [11, 11], [11, 23], [1, 23], [1, 11]], '#3A2018');                // bottle
    px(2, 12, 2, 9, '#5A3426'); px(3, 14, 7, 6, '#F7F3E8'); px(5, 16, 3, 2, '#C9301F');      // sheen, label, mark
  });

  D('scallion', 22, 22, ({ poly, px }) => {
    poly([[2, 20], [5, 17], [8, 19], [5, 22]], '#F7F3E8'); px(2, 21, 2, 1, '#D8CDB0');      // white root end
    poly([[5, 17], [16, 4], [18, 6], [8, 19]], '#5DA83A'); poly([[12, 9], [21, 1], [21, 3], [14, 11]], '#9AD66B'); poly([[14, 8], [15, 1], [17, 2], [16, 8]], '#4E9132');
  });

  D('mushroom', 20, 18, ({ circ, poly, px }) => {
    poly([[1, 8], [4, 2], [10, 0], [16, 2], [19, 8], [17, 10], [3, 10]], '#7A4A2A');
    px(5, 3, 2, 1, '#9A6A44'); px(11, 2, 3, 1, '#9A6A44'); px(8, 5, 1, 1, '#E8D8BC'); px(13, 6, 1, 1, '#E8D8BC'); px(5, 7, 1, 1, '#E8D8BC'); // cap + star cut
    px(3, 10, 14, 1, '#E8D8BC'); poly([[8, 11], [12, 11], [13, 17], [7, 17]], '#E8D8BC'); px(8, 12, 1, 4, '#CDB998');
  });

  D('nori', 18, 18, ({ px }) => {
    px(1, 1, 16, 16, '#1F3B2A'); for (let i = 0; i < 5; i++) px(2, 3 + i * 3, 14, 1, '#2F5A3E'); px(14, 2, 2, 2, '#3F7050');
  });

  D('ajitama', 20, 16, ({ circ, px }) => {
    circ(10, 8, 8, '#F7F3E8'); circ(10, 8, 7, '#EFE6D2'); circ(10, 8, 4, '#E58A14'); circ(9, 7, 3, '#F5A623'); px(8, 6, 2, 1, '#FFD27A');
    px(4, 3, 2, 1, '#FFFFFF');
  });

  D('ginger', 22, 16, ({ circ, px }) => {
    circ(6, 9, 5, '#D7A55C'); circ(13, 8, 5, '#D7A55C'); circ(18, 6, 3, '#D7A55C'); circ(10, 13, 2, '#C2904A');
    px(4, 7, 3, 1, '#E8C384'); px(12, 6, 3, 1, '#E8C384'); px(9, 9, 1, 3, '#B07C3C'); px(16, 9, 1, 2, '#B07C3C');
  });

  D('chopsticks', 22, 22, ({ poly }) => {
    poly([[1, 19], [17, 1], [19, 2], [3, 21]], '#D9A86C'); poly([[4, 21], [20, 4], [21, 6], [6, 22]], '#B8854A');
    poly([[15, 3], [17, 1], [19, 2], [17, 5]], '#C9301F'); poly([[18, 6], [20, 4], [21, 6], [19, 8]], '#C9301F');
  });

  D('flour', 18, 22, ({ poly, px }) => {
    poly([[3, 4], [15, 4], [17, 21], [1, 21]], '#EDE6D6'); poly([[4, 1], [14, 1], [15, 4], [3, 4]], '#D8CDB0');
    px(5, 9, 8, 5, '#C9301F'); px(7, 10, 4, 3, '#F7F3E8'); px(2, 18, 14, 2, '#D8CDB0');
  });

  window.RAMEN_SET = ['ramen', 'noodles', 'ajitama', 'nori', 'scallion', 'mushroom', 'soy', 'ginger', 'garlic', 'chopsticks', 'pot', 'flour'];
})();
