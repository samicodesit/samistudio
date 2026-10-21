import {motionPreference} from './motion-preferences.mjs';
import {advanceSpring} from './terminal-scene-motion.mjs';

export function initExplodedTerminal({trigger,page=document,isAvailable=()=>true,onEnter=()=>{},onExit=()=>{},reducedMotion=motionPreference,
  loadRenderer=()=>import('./terminal-renderer.mjs'),setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const experience=page.querySelector('.experience'),stage=page.createElement('div');stage.className='terminal-exploded';stage.hidden=true;experience.append(stage);
  let renderer=null,preparation=null,active=false,disposed=false,requested=false,suppressClick=false,hold=null,holdTimer=0,frame=0,resizeFrame=0,previousTime=0,target=0,returnFocus=null,sequence=0;
  let spring={position:0,velocity:0};const bindings=[];
  const mobile=()=>page.defaultView.matchMedia('(max-width:1023px)').matches;
  function listen(node,event,fn,options){node.addEventListener(event,fn,options);bindings.push(()=>node.removeEventListener(event,fn,options));}
  function cancelHold(){clearTimer(holdTimer);holdTimer=0;hold=null;delete trigger.dataset.holding;}
  async function warm(){
    if(disposed)return null;
    if(renderer&&renderer.mobile===mobile())return renderer;
    if(preparation)return preparation;
    const version=++sequence,profile=mobile();
    preparation=(async()=>{const {createTerminalRenderer}=await loadRenderer();if(disposed||version!==sequence)return null;
      const prepared=await createTerminalRenderer({stage,mobile:profile,page});if(disposed||version!==sequence){prepared.dispose();return null;}renderer?.dispose();renderer=prepared;return renderer;
    })().catch(reason=>{console.warn('Terminal assembly unavailable:',reason);return null;}).finally(()=>{preparation=null;});
    return preparation;
  }
  function finish(){
    active=false;renderer?.restore();delete experience.dataset.terminalCutaway;trigger.setAttribute('aria-expanded','false');stage.dataset.state='idle';
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;onExit();
  }
  function tick(time){
    frame=0;if(disposed||!active)return;
    const dt=previousTime?Math.min((time-previousTime)/1000,.05):1/60;previousTime=time;
    spring=reducedMotion.matches?{position:target,velocity:0}:advanceSpring(spring,target,dt);
    renderer.render(spring.position);stage.dataset.state=target===1?(spring.position===1?'open':'opening'):'closing';
    if(spring.position===target&&spring.velocity===0){stage.dataset.moving='false';if(!target)finish();return;}
    frame=page.defaultView.requestAnimationFrame(tick);
  }
  function wake(){if(!frame&&active){stage.dataset.moving='true';previousTime=0;frame=page.defaultView.requestAnimationFrame(tick);}}
  async function open(){
    cancelHold();if(disposed||page.hidden||!isAvailable())return;
    requested=true;
    if(active){target=1;wake();return;}
    returnFocus=page.activeElement;if(returnFocus?.tagName==='INPUT')returnFocus=page.querySelector('#display-title')||trigger;
    const prepared=await warm();if(!prepared||!requested||disposed||page.hidden||!isAvailable()){requested=false;return;}
    // A responsive source may change while its lazy construction is in flight.
    // Never activate an assembly registered to the previous photograph.
    if(prepared.mobile!==mobile()){prepared.dispose();if(renderer===prepared)renderer=null;return open();}
    if(active){target=1;wake();return;}
    onEnter();active=true;target=1;spring={position:0,velocity:0};prepared.activate();experience.dataset.terminalCutaway='true';trigger.setAttribute('aria-expanded','true');wake();
  }
  function close({immediate=false}={}){
    cancelHold();requested=false;if(!active)return;target=0;
    if(immediate||reducedMotion.matches){page.defaultView.cancelAnimationFrame(frame);frame=0;spring={position:0,velocity:0};renderer.render(0);finish();}else wake();
  }
  // Intent warms immutable artwork before the hold completes. No page or backdrop opens.
  listen(trigger,'pointerenter',()=>warm(),{passive:true});listen(trigger,'focus',()=>warm());
  listen(trigger,'pointerdown',event=>{suppressClick=false;if(event.button!==0||event.isPrimary===false||active||!isAvailable())return;cancelHold();warm();hold={id:event.pointerId,x:event.clientX,y:event.clientY};trigger.dataset.holding='true';holdTimer=setTimer(()=>{suppressClick=true;open();},700);},{passive:true});
  listen(trigger,'pointermove',event=>{if(hold&&hold.id===event.pointerId&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>8)cancelHold();},{passive:true});
  for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])listen(trigger,event,cancelHold,{passive:true});
  listen(trigger,'click',event=>{if(suppressClick){suppressClick=false;event.preventDefault();return;}if(active){event.preventDefault();target===1?close():open();}else if(event.detail===0){event.preventDefault();open();}});
  listen(trigger,'contextmenu',event=>{if(hold)event.preventDefault();});
  listen(page,'keydown',event=>{if((active||requested)&&event.key==='Escape'){event.preventDefault();close();}});
  listen(page,'visibilitychange',()=>{cancelHold();if(page.hidden&&active)close({immediate:true});});listen(page.defaultView,'blur',cancelHold);
  listen(page.defaultView,'resize',()=>{page.defaultView.cancelAnimationFrame(resizeFrame);resizeFrame=page.defaultView.requestAnimationFrame(()=>{resizeFrame=0;if(renderer&&renderer.mobile!==mobile()){close({immediate:true});renderer.dispose();renderer=null;}else if(active)renderer.refresh();});},{passive:true});
  const motion=()=>{if(active&&reducedMotion.matches){spring={position:target,velocity:0};renderer.render(target);if(!target)finish();}};reducedMotion.addEventListener('change',motion);
  return {open,close,get isOpen(){return active||requested;},destroy(){close({immediate:true});disposed=true;++sequence;page.defaultView.cancelAnimationFrame(frame);page.defaultView.cancelAnimationFrame(resizeFrame);renderer?.dispose();bindings.forEach(remove=>remove());reducedMotion.removeEventListener('change',motion);stage.remove();}};
}
