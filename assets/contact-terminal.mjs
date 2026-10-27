import {projectiveMatrix} from './gallery-geometry.mjs';
import {motionPreference} from './motion-preferences.mjs';

export function contactDraft(values){
  const draft={name:String(values.name??'').trim(),email:String(values.email??'').trim(),message:String(values.message??'').trim()};
  if(!draft.name||draft.name.length>100)throw new Error('Please add your name.');
  if(draft.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email))throw new Error('Please add a valid email address.');
  if(!draft.message||draft.message.length>4000)throw new Error('Please tell me a little about what you need.');
  return draft;
}
export function contactMailto(values){
  const draft=contactDraft(values),name=draft.name.replace(/[\r\n]+/g,' ');
  return 'mailto:hello@samistudio.nl?'+new URLSearchParams({subject:`Something needs doing: ${name}`,body:`Hi Sami,\n\n${draft.message}\n\n${draft.name}\n${draft.email}`}).toString().replaceAll('+','%20');
}
export function openContactEmail(values,{page=document}={}){
  const link=page.createElement('a');link.href=contactMailto(values);link.click();return {delivery:'email-app'};
}
export function initContactTerminal({page=document,reducedMotion=motionPreference,onEnter=()=>{},onExit=()=>{},onStateChange=()=>{},onUnavailable=()=>{},sendMessage=values=>openContactEmail(values,{page})}={}){
  const view=page.defaultView,entries=[...page.querySelectorAll('[data-contact-entry]')],entry=entries[0],dialog=page.querySelector('#contact-terminal'),panel=dialog.querySelector('.contact-monitor'),lcd=dialog.querySelector('.contact-lcd'),form=dialog.querySelector('form'),status=dialog.querySelector('.contact-status'),submit=form.querySelector('[type="submit"]'),closeButton=dialog.querySelector('.contact-close');
  let animation=null,contentAnimation=null,returnFocus=null,sequence=0,pending=false,disposed=false,ownsHistory=false,baseHash='',backdropDown=false,displayPrepared=false,frameReady=null;
  const bindings=[];
  const busy=active=>entries.forEach(node=>active?node.setAttribute('aria-busy','true'):node.removeAttribute('aria-busy'));
  function prepareFrame(){
    if(!frameReady){const image=new view.Image();image.fetchPriority='low';image.src=new URL('./contact-screen-frame.png',import.meta.url).href;frameReady=image.decode().catch(error=>{frameReady=null;throw error;});}
    return frameReady;
  }
  prepareFrame().catch(()=>{});
  function listen(node,type,handler,options){node?.addEventListener(type,handler,options);bindings.push(()=>node?.removeEventListener(type,handler,options));}
  function viewport(){const v=view.visualViewport;if(v&&v.scale===1){dialog.style.setProperty('--contact-vh',v.height+'px');dialog.style.setProperty('--contact-vy',v.offsetTop+'px');}else{dialog.style.removeProperty('--contact-vh');dialog.style.removeProperty('--contact-vy');}}
  function sourceTransform(){
    const terminal=page.querySelector('.terminal').getBoundingClientRect(),rect=panel.getBoundingClientRect(),scale=parseFloat(view.getComputedStyle(page.documentElement).getPropertyValue('--scene-scale'))||1;
    const quad=view.matchMedia('(max-width:1023px)').matches?[[43,388],[373,388],[374,611],[43,611]]:[[136,303],[551,270],[604,537],[179,578]];
    return projectiveMatrix(rect.width,rect.height,quad.map(([x,y])=>[terminal.left+x*scale-rect.left,terminal.top+y*scale-rect.top]));
  }
  function stop(){animation?.cancel();contentAnimation?.cancel();animation=contentAnimation=null;panel.style.removeProperty('transform');lcd.style.removeProperty('opacity');}
  async function open({fromHistory=false,trigger=page.activeElement}={}){
    if(disposed||dialog.dataset.phase==='loading'||(dialog.open&&dialog.dataset.phase!=='closing'))return;
    const resume=dialog.open?{transform:view.getComputedStyle(panel).transform,opacity:view.getComputedStyle(panel).opacity,contentOpacity:view.getComputedStyle(lcd).opacity}:null;
    const token=++sequence;
    if(resume)stop();else{returnFocus=trigger;dialog.dataset.phase='loading';busy(true);onEnter();onStateChange();}
    if(!fromHistory){baseHash=view.location.hash;view.history.pushState({contactTerminal:true},'','#contact');}ownsHistory=Boolean(view.history.state?.contactTerminal);
    if(!resume){
      try{await prepareFrame();}catch{if(token===sequence&&!disposed){requestClose();onUnavailable();}return;}
      if(token!==sequence||disposed)return;
      busy(false);viewport();dialog.dataset.phase='preparing';dialog.showModal();
    }else dialog.dataset.phase='preparing';
    onStateChange();dialog.querySelector('h2').focus({preventScroll:true});
    if(!reducedMotion.matches){
      // Paint the photographic source pose before its first flight. This gives
      // the compositor time to upload the frame and native field glyphs without
      // skipping the beginning of the zoom on a cold graphics context.
      if(!displayPrepared&&!resume){panel.style.transform=sourceTransform();lcd.style.opacity='.001';for(let i=0;i<5;i++)await new Promise(resolve=>view.requestAnimationFrame(resolve));if(token!==sequence||!dialog.open)return;displayPrepared=true;stop();}
      if(reducedMotion.matches){stop();dialog.dataset.phase='open';return;}
      dialog.dataset.phase='opening';
      animation=panel.animate([{transform:resume?.transform||sourceTransform(),opacity:resume?.opacity??.85},{transform:'none',opacity:1}],{duration:resume?320:640,easing:'cubic-bezier(.22,1,.36,1)'});
      contentAnimation=lcd.animate(resume?[{opacity:resume.contentOpacity},{opacity:1}]:[{opacity:0},{opacity:0,offset:.2},{opacity:1}],{duration:resume?320:640,easing:'ease-out'});
      await Promise.allSettled([animation.finished,contentAnimation.finished]);
    }
    if(token===sequence&&dialog.open){stop();displayPrepared=true;dialog.dataset.phase='open';}
  }
  async function close(){
    const loading=dialog.dataset.phase==='loading';
    if((!dialog.open&&!loading)||dialog.dataset.phase==='closing')return;
    const token=++sequence,style=view.getComputedStyle(panel),from=style.transform,opacity=style.opacity,lcdOpacity=view.getComputedStyle(lcd).opacity;stop();lcd.style.opacity=lcdOpacity;dialog.dataset.phase='closing';
    if(dialog.contains(page.activeElement))page.activeElement.blur();
    if(!loading&&!reducedMotion.matches){animation=panel.animate([{transform:from,opacity},{transform:sourceTransform(),opacity:0}],{duration:420,easing:'cubic-bezier(.4,0,.2,1)'});await animation.finished.catch(()=>{});}
    if(token!==sequence)return;stop();busy(false);if(dialog.open)dialog.close();dialog.dataset.phase='closed';onExit();onStateChange();
    const focus=returnFocus&&returnFocus!==page.body&&returnFocus.isConnected?returnFocus:entry;focus.focus({preventScroll:true});returnFocus=null;
  }
  function requestClose(){
    if(dialog.dataset.phase==='loading')close();
    if(ownsHistory&&view.location.hash==='#contact'){ownsHistory=false;view.history.back();}
    else{if(view.location.hash==='#contact')view.history.replaceState(null,'',view.location.pathname+view.location.search+baseHash);close();}
  }
  for(const node of entries)listen(node,'click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();open({trigger:node});});
  listen(closeButton,'click',requestClose);
  listen(dialog,'cancel',event=>{event.preventDefault();requestClose();});
  listen(view,'keydown',event=>{if(event.key==='Escape'&&dialog.dataset.phase==='loading'){event.preventDefault();requestClose();}});
  listen(dialog,'keydown',event=>{
    if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
    const controls=[...dialog.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')].filter(node=>node.tabIndex>=0&&node.getClientRects().length);
    if(!controls.length)return;
    // WebKit can omit links from native Tab navigation. Move through the whole
    // visible form explicitly so that its last focusable control is consistent.
    event.preventDefault();
    const index=controls.indexOf(page.activeElement),next=index<0?(event.shiftKey?controls.length-1:0):(index+(event.shiftKey?-1:1)+controls.length)%controls.length;
    controls[next].focus();
  });
  const outside=target=>target===dialog||target.classList?.contains('contact-stage');
  listen(dialog,'pointerdown',event=>{backdropDown=outside(event.target);});
  listen(dialog,'click',event=>{if(backdropDown&&outside(event.target))requestClose();backdropDown=false;});
  listen(view,'popstate',()=>{if(view.location.hash==='#contact')open({fromHistory:true});else{ownsHistory=false;close();}});
  listen(view,'resize',()=>{viewport();animation?.finish();contentAnimation?.finish();},{passive:true});
  listen(view.visualViewport,'resize',()=>{if(!dialog.open)return;viewport();if(dialog.contains(page.activeElement))requestAnimationFrame(()=>page.activeElement.scrollIntoView({block:'nearest',behavior:'instant'}));},{passive:true});
  listen(reducedMotion,'change',()=>{if(reducedMotion.matches){animation?.finish();contentAnimation?.finish();}});
  listen(form,'input',()=>{if(!pending){status.textContent='Opens your email app.';status.dataset.state='idle';}});
  listen(form,'submit',async event=>{
    event.preventDefault();if(pending||!form.reportValidity())return;status.textContent='';status.dataset.state='idle';
    try{
      const draft=contactDraft(Object.fromEntries(new FormData(form)));pending=true;submit.disabled=true;form.setAttribute('aria-busy','true');
      const result=await sendMessage(draft);if(!['email-app','sent'].includes(result?.delivery))throw Error('Your message could not be sent. Please try again.');status.textContent=result.delivery==='email-app'?'Your email draft is ready to send.':"Email sent. I’ll get back to you.";status.dataset.state='success';
    }catch(error){status.textContent=error?.message||'Your message could not be sent. Please try again.';status.dataset.state='error';}
    finally{pending=false;submit.disabled=false;form.removeAttribute('aria-busy');}
  });
  return {open,close:requestClose,get isOpen(){return dialog.open||dialog.dataset.phase==='loading';},ready(){if(view.location.hash==='#contact')open({fromHistory:true});},destroy(){disposed=true;++sequence;stop();busy(false);bindings.forEach(unbind=>unbind());if(dialog.open){dialog.close();onExit();}}};
}
