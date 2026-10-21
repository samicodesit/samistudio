// Functional assembly order. Pixel registration lives in terminal-construction.mjs.
export const terminalParts=Object.freeze([
  {id:'rear',title:'Rear enclosure',material:'Moulded polymer',description:'A deep shell protects the electronics. Four brass inserts receive the screws that hold the front housing in place.'},
  {id:'board',title:'Logic board',material:'Circuit board + copper',description:'The board connects the display, indicator and three mechanical switches. The switches sit directly behind their matching keys.'},
  {id:'display',title:'Display module',material:'Glass + aluminium',description:'A flat display sits in a black carrier behind the front opening. A short ribbon connects it to the logic board.'},
  {id:'housing',title:'Front housing',material:'Moulded polymer + brass',description:'The cream face locates the display and three keys. Recessed openings protect their edges and guide each key onto its switch.'},
  {id:'keys',title:'Three keycaps',material:'Textured polymer',description:'Work, About and Contact each press a separate switch. The hollow caps lift straight off the stems below them.'},
].map(Object.freeze));
