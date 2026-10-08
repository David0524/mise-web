/* Original pixel objects for "who i am": the things a conversation is made of. No logos or brand marks. */
(function () {
  const D = PPM.defSprite;

  D('bubble', 22, 20, ({ px, poly }) => {          // a speech bubble with three typing dots
    px(1, 2, 20, 12, '#F7F3E8'); px(2, 1, 18, 1, '#F7F3E8'); px(2, 14, 18, 1, '#F7F3E8');
    poly([[5, 14], [10, 14], [4, 19]], '#F7F3E8'); px(2, 2, 18, 1, '#FFFFFF');
    px(5, 7, 3, 3, '#C9301F'); px(10, 7, 3, 3, '#C9301F'); px(15, 7, 3, 3, '#C9301F');
  });

  D('question', 14, 22, ({ px }) => {               // a chunky question mark
    px(3, 1, 8, 3, '#2E5BFF'); px(1, 3, 3, 4, '#2E5BFF'); px(10, 3, 3, 6, '#2E5BFF'); px(7, 8, 4, 3, '#2E5BFF');
    px(6, 10, 3, 5, '#2E5BFF'); px(6, 17, 3, 3, '#2E5BFF'); px(4, 1, 4, 1, '#7FA0FF'); px(11, 4, 1, 3, '#1B3DB8');
  });

  D('pencil', 22, 22, ({ poly, px }) => {
    poly([[3, 19], [15, 7], [19, 11], [7, 23]], '#F2B33A'); poly([[15, 7], [17, 5], [21, 9], [19, 11]], '#E58A9A');
    poly([[17, 5], [18, 4], [22, 8], [21, 9]], '#9A9899'); poly([[3, 19], [7, 23], [1, 23]], '#E8C99A'); px(1, 21, 2, 2, '#322823');
    poly([[5, 19], [15, 9], [16, 10], [6, 20]], '#FFD27A');
  });

  D('envelope', 24, 16, ({ px, poly }) => {
    px(1, 1, 22, 14, '#EDE6D6'); poly([[1, 1], [23, 1], [12, 9]], '#D8CDB0'); poly([[1, 15], [10, 8], [14, 8], [23, 15]], '#E3DAC6');
    px(10, 7, 4, 3, '#C9301F'); px(11, 7, 2, 1, '#E04A35');  // wax seal
  });

  D('bulb', 16, 22, ({ circ, px }) => {
    circ(8, 7, 7, '#FFE58A'); circ(6, 5, 2, '#FFF6CF'); px(5, 12, 6, 2, '#FFE58A');
    px(7, 7, 1, 5, '#E89B2A'); px(9, 7, 1, 5, '#E89B2A'); px(7, 7, 3, 1, '#E89B2A');
    px(5, 14, 6, 2, '#9A9899'); px(5, 16, 6, 1, '#6E6C6E'); px(5, 17, 6, 2, '#9A9899'); px(6, 19, 4, 2, '#6E6C6E');
  });

  D('globe', 20, 22, ({ circ, px }) => {
    circ(10, 9, 8, '#3F86D8'); px(5, 4, 4, 3, '#5DA83A'); px(4, 7, 3, 4, '#5DA83A'); px(11, 6, 5, 3, '#5DA83A'); px(12, 9, 3, 5, '#5DA83A'); px(7, 13, 3, 2, '#5DA83A');
    px(6, 3, 2, 1, '#9CC7F2'); px(2, 19, 16, 2, '#6E6C6E'); px(9, 17, 2, 2, '#9A9899');
  });

  D('code', 24, 16, ({ px }) => {                   // a little terminal: </>
    px(0, 0, 24, 16, '#26303A'); px(0, 0, 24, 3, '#3A4652'); px(2, 1, 1, 1, '#E04A35'); px(4, 1, 1, 1, '#F2B33A'); px(6, 1, 1, 1, '#5DA83A');
    px(5, 8, 2, 1, '#9AD66B'); px(4, 9, 2, 1, '#9AD66B'); px(5, 10, 2, 1, '#9AD66B'); px(6, 7, 1, 1, '#9AD66B'); px(6, 11, 1, 1, '#9AD66B');
    px(11, 6, 1, 2, '#F7F3E8'); px(10, 8, 1, 2, '#F7F3E8'); px(9, 10, 1, 2, '#F7F3E8');
    px(17, 8, 2, 1, '#9AD66B'); px(18, 9, 2, 1, '#9AD66B'); px(17, 10, 2, 1, '#9AD66B'); px(16, 7, 1, 1, '#9AD66B'); px(16, 11, 1, 1, '#9AD66B');
  });

  D('hourglass', 14, 22, ({ px, poly }) => {
    px(0, 0, 14, 2, '#8E5A2E'); px(0, 20, 14, 2, '#8E5A2E');
    poly([[1, 2], [13, 2], [8, 11], [13, 20], [1, 20], [6, 11]], '#E8F1F5');
    poly([[3, 4], [11, 4], [7, 9]], '#E2B85A'); poly([[7, 13], [11, 19], [3, 19]], '#E2B85A'); px(7, 10, 1, 4, '#E2B85A');
  });

  D('key', 22, 12, ({ circ, px, x }) => {
    circ(5, 6, 5, '#E2B33A'); x.globalCompositeOperation = 'destination-out'; circ(5, 6, 2, '#000'); x.globalCompositeOperation = 'source-over'; px(9, 5, 12, 3, '#E2B33A'); px(16, 8, 2, 3, '#E2B33A'); px(19, 8, 2, 2, '#E2B33A'); px(10, 5, 10, 1, '#F8D27A');
  });

  D('moon', 20, 20, ({ circ, x, px }) => {
    circ(9, 10, 8, '#F4E6B8'); circ(7, 8, 2, '#E3CF92'); circ(11, 14, 1, '#E3CF92');
    x.globalCompositeOperation = 'destination-out'; circ(14, 7, 7, '#000'); x.globalCompositeOperation = 'source-over';
    px(16, 14, 1, 3, '#F4E6B8'); px(15, 15, 3, 1, '#F4E6B8'); px(17, 3, 1, 1, '#F4E6B8');
  });

  window.SELF_SET = ['bubble', 'book', 'envelope', 'pencil', 'question', 'bulb', 'globe', 'code', 'note', 'heart', 'hourglass', 'key'];
})();
