// Model units are construction units, not claims about a manufactured product.
export const terminalDimensions=Object.freeze({
  width:110,height:98,innerWidth:102,innerHeight:90,
  boardWidth:98,boardHeight:84,screenOpeningWidth:90,screenOpeningHeight:59,
  displayWidth:81,displayHeight:49,
});
export const terminalParts=Object.freeze([
  {id:'rear',title:'Rear enclosure',material:'Moulded polymer',description:'A deep shell protects the electronics. Four brass inserts receive the screws that hold the front housing in place.',z:-8,depth:28,travel:-95},
  {id:'board',title:'Logic board',material:'Circuit board + copper',description:'The board connects the display, indicator and three mechanical switches. The switches sit directly behind their matching keys.',z:6,depth:6,travel:-45},
  {id:'display',title:'Display module',material:'Glass + aluminium',description:'A flat display sits in a black carrier behind the front opening. A short ribbon connects it to the logic board.',z:13,depth:8,travel:10},
  {id:'housing',title:'Front housing',material:'Moulded polymer + brass',description:'The cream face locates the display and three keys. Recessed openings protect their edges and guide each key onto its switch.',z:17,depth:8,travel:70},
  {id:'keys',title:'Three keycaps',material:'Textured polymer',description:'Work, About and Contact each press a separate switch. The hollow caps lift straight off the stems below them.',z:25,depth:10,travel:125},
].map(Object.freeze));
export function partOffset(id,value){
  const part=terminalParts.find(p=>p.id===id);
  if(!part)throw new Error(`Unknown terminal part: ${id}`);
  const t=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
  return [0,0,t?part.travel*t:0];
}
