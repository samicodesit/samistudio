import {terminalParts} from './terminal-assembly.mjs';
import {motionPreference} from './motion-preferences.mjs';

export function initExplodedTerminal({trigger,page=document,isAvailable=()=>true,onEnter=()=>{},
  reducedMotion=motionPreference,loadRenderer=()=>import('./terminal-renderer.mjs'),setTimer=setTimeout,clearTimer=clearTimeout}={}){
  const dialog=page.createElement('dialog');dialog.className='terminal-exploded';dialog.setAttribute('aria-labelledby','te-title');
  dialog.innerHTML=`<div class="te-layout">
    <header class="te-header"><div><p class="te-origin">Sami Studio terminal</p><h2 id="te-title">Under the shell.</h2></div><button class="te-close" type="button" aria-label="Back to terminal"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6"/></svg><span>Back to terminal</span></button></header>
    <div class="te-body"><div class="te-stage"><canvas aria-label="Exploded assembly of the actual Sami Studio terminal. Select a part to inspect it."></canvas><p class="te-loading" role="status">Preparing the assembly...</p><div class="te-error" hidden><p>The assembly could not load.</p><button type="button" class="te-retry">Try again</button></div><div class="te-view-tools"><span>Select a part to inspect</span><button class="te-reset" type="button" aria-label="Show full assembly">Show all parts</button></div></div>
    <aside class="te-inspector" aria-label="Terminal parts"><p class="te-parts-label">Inside the terminal</p><div class="te-parts">${terminalParts.map((p,i)=>`<button type="button" data-part="${p.id}" aria-label="Inspect ${p.title.toLowerCase()}" aria-pressed="false"><span class="te-part-index">${String(i+1).padStart(2,'0')}</span><span class="te-full-title">${p.title}</span><span class="te-short-title">${['Rear','Board','Display','Front','Keys'][i]}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>`).join('')}</div><div class="te-description" aria-live="polite"><p class="te-material"></p><p class="te-part-copy"></p></div></aside></div>
    <footer class="te-footer"><div class="te-separation"><label for="te-range">Separation</label><div class="te-range-row"><span>Assembled</span><input id="te-range" type="range" min="0" max="100" step="1" value="0" aria-valuetext="Assembled"><span>Exploded</span></div></div><button class="te-assemble" type="button">Reassemble<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 4 5 3 5-3M5 16l5-3 5 3M10 7v6"/></svg></button></footer>
    <span class="sr-only te-status" role="status" aria-live="polite"></span></div>`;
  page.body.append(dialog);
  const canvas=dialog.querySelector('canvas'),range=dialog.querySelector('#te-range'),loading=dialog.querySelector('.te-loading'),error=dialog.querySelector('.te-error'),toggle=dialog.querySelector('.te-assemble');
  let renderer=null,token=0,active=false,disposed=false,returnFocus=null,hold=null,timer=0,revealTimer=0,progress=1;
  const bindings=[];
  function listen(node,event,fn,options){node.addEventListener(event,fn,options);bindings.push(()=>node.removeEventListener(event,fn,options));}
  function cancelHold(){clearTimer(timer);timer=0;hold=null;delete trigger.dataset.holding;}
  function select(id,{inspect=false}={}){
    const part=terminalParts.find(p=>p.id===id);if(!part)return;
    for(const button of dialog.querySelectorAll('[data-part]'))button.setAttribute('aria-pressed',String(button.dataset.part===id));
    dialog.querySelector('.te-material').textContent=part.material;dialog.querySelector('.te-part-copy').textContent=part.description;renderer?.select(id,{inspect});
  }
  function separation(value,animate=false){
    progress=Math.max(0,Math.min(1,value));range.value=Math.round(progress*100);
    range.setAttribute('aria-valuetext',progress===0?'Assembled':progress===1?'Fully exploded':`${Math.round(progress*100)} percent separated`);
    toggle.firstChild.textContent=progress>.01?'Reassemble':'Explode';renderer?.setSeparation(progress,{animate});
  }
  function fail(reason){console.warn('Terminal assembly unavailable:',reason);loading.hidden=true;error.hidden=false;canvas.hidden=true;renderer?.dispose();renderer=null;dialog.dataset.state='error';}
  async function prepare(){
    const attempt=++token;clearTimer(revealTimer);renderer?.dispose();renderer=null;loading.hidden=false;error.hidden=true;canvas.hidden=false;dialog.dataset.state='loading';
    try{
      const {createTerminalRenderer}=await loadRenderer();if(!active||attempt!==token||disposed)return;
      const prepared=await createTerminalRenderer({canvas,reducedMotion,onSelect:id=>select(id,{inspect:true}),onError:reason=>{if(active&&attempt===token)fail(reason);}});
      if(!active||attempt!==token||disposed){prepared.dispose();return;}
      renderer=prepared;
      loading.hidden=true;dialog.dataset.state='ready';select('housing');separation(0);
      // Let the assembled silhouette register before the mounting-axis reveal.
      clearTimer(revealTimer);revealTimer=setTimer(()=>{if(active&&attempt===token){separation(1,true);dialog.querySelector('.te-status').textContent='Terminal separated into five assemblies.';}},reducedMotion.matches?0:420);
    }catch(reason){if(active&&attempt===token)fail(reason);}
  }
  function open(){
    cancelHold();if(active||disposed||page.hidden||!isAvailable())return;
    returnFocus=page.activeElement;
    if(returnFocus?.tagName==='INPUT')returnFocus=page.querySelector('#display-title')||trigger;
    onEnter();active=true;trigger.setAttribute('aria-expanded','true');
    dialog.showModal();dialog.querySelector('.te-close').focus({preventScroll:true});prepare();
  }
  function close(){
    cancelHold();clearTimer(revealTimer);if(!active)return;active=false;++token;renderer?.dispose();renderer=null;dialog.close();trigger.setAttribute('aria-expanded','false');
    const target=returnFocus?.isConnected?returnFocus:trigger;target.focus({preventScroll:true});returnFocus=null;
  }
  listen(trigger,'pointerdown',event=>{if(event.button!==0||event.isPrimary===false||!isAvailable())return;cancelHold();hold={id:event.pointerId,x:event.clientX,y:event.clientY};trigger.dataset.holding='true';timer=setTimer(open,700);},{passive:true});
  listen(trigger,'pointermove',event=>{if(hold&&hold.id===event.pointerId&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>8)cancelHold();},{passive:true});
  for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])listen(trigger,event,cancelHold,{passive:true});
  listen(trigger,'click',event=>{if(event.detail===0){event.preventDefault();open();}});
  listen(trigger,'contextmenu',event=>{if(hold)event.preventDefault();});
  listen(page,'visibilitychange',cancelHold);listen(page.defaultView,'blur',cancelHold);
  listen(dialog,'cancel',event=>{event.preventDefault();close();});listen(dialog,'close',()=>{if(active&&!dialog.open)close();});
  listen(dialog,'keydown',event=>{
    if(event.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[hidden],[inert]'));
    const first=controls[0],last=controls.at(-1);if(!first)return;
    if(event.shiftKey&&(page.activeElement===first||!controls.includes(page.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(page.activeElement===last||!controls.includes(page.activeElement))){event.preventDefault();first.focus();}
  });
  listen(dialog.querySelector('.te-close'),'click',close);listen(dialog.querySelector('.te-retry'),'click',prepare);
  listen(dialog.querySelector('.te-reset'),'click',()=>renderer?.resetView());
  listen(range,'input',()=>{clearTimer(revealTimer);separation(Number(range.value)/100);});
  listen(toggle,'click',()=>{clearTimer(revealTimer);separation(progress>.01?0:1,true);});
  for(const button of dialog.querySelectorAll('[data-part]'))listen(button,'click',()=>select(button.dataset.part,{inspect:true}));
  return {open,close,get isOpen(){return active;},destroy(){close();disposed=true;bindings.forEach(remove=>remove());dialog.remove();}};
}
