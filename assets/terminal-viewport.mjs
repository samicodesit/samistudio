// Frame the same photographed LCD inside the area above a software keyboard.
export function fitTerminalEditor({width,height,offsetLeft=0,offsetTop=0}) {
 if(![width,height,offsetLeft,offsetTop].every(Number.isFinite)||width<=32||height<=32)throw new RangeError('Invalid visual viewport');
 const scale=Math.min((width-32)/273,(height-32)/170,1.55);
 return {scale,left:offsetLeft+(width-273*scale)/2-73*scale,top:offsetTop+16-419*scale};
}

export function initTerminalViewport({input,page=document,view=page.defaultView,isOpen,onChange,containsFocus=()=>page.activeElement===input||input.form?.contains(page.activeElement),
 requestFrame=fn=>view.requestAnimationFrame(fn),cancelFrame=id=>view.cancelAnimationFrame(id)}) {
 const viewport=view.visualViewport,media=view.matchMedia('(max-width: 1023px)'),bindings=[];
 let frame=null,pending=0,disposed=false,keyboardSeen=false,keyboardDismissed=false,baselineHeight=viewport?.height||view.innerHeight,baselineWidth=view.innerWidth;
 function listen(target,type,fn){if(!target)return;target.addEventListener(type,fn,{passive:true});bindings.push(()=>target.removeEventListener(type,fn));}
 function update(){
  pending=0;if(disposed)return;
  const opened=media.matches&&isOpen();
  if(!opened){keyboardSeen=false;keyboardDismissed=false;if(frame){frame=null;onChange?.(null);}return;}
  if(viewport&&Math.abs(viewport.scale-1)>.01)return;
  const width=viewport?.width||view.innerWidth,height=viewport?.height||view.innerHeight;
  const focused=page.activeElement===input;
  if(view.innerWidth!==baselineWidth){baselineWidth=view.innerWidth;baselineHeight=view.innerHeight;}
  if(!frame&&!focused)baselineHeight=Math.max(height,view.innerHeight);
  const keyboardVisible=baselineHeight-height>120;
  if(keyboardVisible){keyboardSeen=true;keyboardDismissed=false;}else if(keyboardSeen){keyboardSeen=false;keyboardDismissed=true;}
  const editing=!keyboardDismissed&&(focused||(frame&&(containsFocus()||keyboardVisible)));
  const next=editing?fitTerminalEditor({width,height,offsetLeft:viewport?.offsetLeft||0,offsetTop:viewport?.offsetTop||0}):null;
  if(JSON.stringify(next)===JSON.stringify(frame))return;
  frame=next;onChange?.(frame);
 }
 function refresh(){if(!disposed&&!pending)pending=requestFrame(update);}
 listen(input,'focus',()=>{keyboardDismissed=false;refresh();});listen(input,'blur',refresh);
 for(const type of ['resize','scroll'])listen(viewport,type,refresh);
 listen(view,'resize',refresh);listen(media,'change',refresh);
 return {refresh,get frame(){return frame;},destroy(){disposed=true;if(pending)cancelFrame(pending);pending=0;bindings.forEach(remove=>remove());frame=null;}};
}
