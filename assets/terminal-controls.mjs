// Native terminal state and deliberate gestures. Gallery artwork/loading stays
// owned by the existing gallery controller.
export function initTerminalControls({display,pilot,keys,screens,onPage,onLeaveWork,onOpen,
  reducedMotion=false,isVisible=()=>true,setTimer=setTimeout,clearTimer=clearTimeout}) {
  const title=display.querySelector('#display-title');
  const counter=display.querySelector('#display-number');
  const pagination=display.querySelector('.display-pagination');
  const announcement=display.querySelector('#display-announcement');
  const contact=display.querySelector('#contact-display-link');
  const work=screens.find(screen=>screen.dataset.screen==='work');
  const names={work:'Work',about:'About',contact:'Contact'};
  let current='work',index=0,total=3,ledTimer=0,gesture=null,suppressClick=false,pagingMotion=null;

  const motionAllowed=()=>isVisible()&&!(typeof reducedMotion==='boolean'?reducedMotion:reducedMotion.matches);
  function announce(){announcement.textContent=current==='work'?`Work, project ${index+1} of ${total}.`:names[current];}
  function show(view,focusElement){
    if(!names[view])return;
    const changed=current!==view;
    if(view!=='work')onLeaveWork?.();
    current=view;title.textContent=names[view];
    pagination.hidden=view!=='work';contact.hidden=view!=='contact';
    screens.forEach(screen=>{screen.hidden=screen.dataset.screen!==view;});
    keys.forEach(key=>key.setAttribute('aria-pressed',String(key.dataset.view===view)));
    display.dataset.view=view;announce();
    if(changed&&motionAllowed()){
      pagingMotion?.cancel();
      pagingMotion=screens.find(screen=>!screen.hidden).animate([
        {opacity:.4,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}
      ],{duration:160,easing:'cubic-bezier(.2,.75,.12,1)'});
    }
    focusElement?.focus({preventScroll:true});
  }
  function projectChanged(next,count){
    const previous=index;index=next;total=count;counter.textContent=`${index+1}/${total}`;
    if(current==='work'&&next!==previous&&motionAllowed()){
      pagingMotion?.cancel();
      pagingMotion=work.animate([{opacity:.35,transform:`translateX(${next>previous?8:-8}px)`},
        {opacity:1,transform:'translateX(0)'}],{duration:180,easing:'cubic-bezier(.2,.75,.12,1)'});
    }
    announce();
  }
  function pulse(){
    clearTimer(ledTimer);pilot.classList.add('is-lit');
    ledTimer=setTimer(()=>pilot.classList.remove('is-lit'),300);
  }
  display.querySelector('[data-page="previous"]').addEventListener('click',()=>onPage(-1));
  display.querySelector('[data-page="next"]').addEventListener('click',()=>onPage(1));
  display.addEventListener('keydown',event=>{
    if(current!=='work'||event.altKey||event.metaKey||event.ctrlKey)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();onPage(event.key==='ArrowRight'?1:-1);
    }
  });
  display.addEventListener('pointerdown',event=>{
    if(current!=='work'||event.button!==0)return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,width:display.getBoundingClientRect().width};
  },{passive:true});
  display.addEventListener('pointercancel',()=>{gesture=null;},{passive:true});
  display.addEventListener('pointerup',event=>{
    if(!gesture||event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    const threshold=Math.max(24,Math.min(48,gesture.width*.13));gesture=null;
    if(Math.abs(dx)<threshold||Math.abs(dx)<Math.abs(dy)*1.5)return;
    suppressClick=true;onPage(dx<0?1:-1);
    setTimer(()=>{suppressClick=false;},0);
  },{passive:true});
  display.addEventListener('click',event=>{
    if(current==='work'&&!event.target.closest('button,a'))onOpen?.();
  });
  // Browser click follows pointerup. A completed swipe must not open the next
  // project's gallery as though it was a tap.
  display.addEventListener('click',event=>{
    if(!suppressClick)return;
    suppressClick=false;event.preventDefault();event.stopImmediatePropagation();
  },true);
  show('work');projectChanged(0,3);
  return {show,projectChanged,pulse};
}
