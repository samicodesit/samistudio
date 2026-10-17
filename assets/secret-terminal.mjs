import {createPlayground} from './javascript-playground.mjs';
import {projects, getProject} from './project-data.mjs';

// This is a small portfolio command language, never an operating-system shell.
export function parseTerminalCommand(value) {
  if(typeof value!=='string'||value.length>80)return {type:'unknown'};
  const command=value.trim().toLowerCase().replace(/\s+/g,' ');
  if(!command)return {type:'empty'};
  if(['ls','whoami','help','exit'].includes(command))return {type:command};
  if(command==='open')return {type:'ls'};
  const match=/^open ([a-z]+)$/.exec(command);
  return match&&getProject(match[1]) ? {type:'open',id:match[1]} : {type:'unknown'};
}

export function initSecretTerminal({display,page=document,reducedMotion={matches:false},isAvailable=()=>true,
  canType=()=>true,onEnter,onExit,onOpenProject,onChange,setTimer=setTimeout,clearTimer=clearTimeout,makePlayground=()=>createPlayground({page})}) {
  const trigger=display.querySelector('#display-title');
  const screen=display.querySelector('.screen-shell');
  const output=display.querySelector('.shell-output');
  const form=display.querySelector('.shell-form');
  const input=display.querySelector('.shell-input');
  const exit=display.querySelector('.shell-exit');
  const pagination=display.querySelector('.display-pagination');
  const work=display.querySelector('.screen-work');
  const announcement=display.querySelector('#display-announcement');
  const bindings=[],history=[];
  let playground=null,runSequence=0,busy=false;
  let active=false,disposed=false,hold=null,holdTimer=0,motion=null,historyIndex=0,draft='';
  function listen(target,event,fn,options){
    target.addEventListener(event,fn,options);
    bindings.push(()=>target.removeEventListener(event,fn,options));
  }
  function cancelHold(){clearTimer(holdTimer);holdTimer=0;hold=null;delete trigger.dataset.holding;}
  function response(text){
    output.dataset.kind='text';
    const paragraph=page.createElement('p');paragraph.textContent=text;
    output.replaceChildren(paragraph);output.scrollTop=0;
  }
  function append(text,kind='result'){
    output.dataset.kind='console';
    const p=page.createElement('p');p.textContent=text;p.dataset.kind=kind;output.append(p);
    while(output.children.length>40)output.children[0].remove();
    output.scrollTop=output.scrollHeight;
  }
  function welcome(){output.replaceChildren();output.dataset.kind='console';}
  function listProjects(){
    output.replaceChildren();
    output.dataset.kind='projects';
    const list=page.createElement('div');list.className='shell-projects';
    for(const project of projects){
      const button=page.createElement('button');button.type='button';button.textContent=project.title;
      button.setAttribute('aria-label',`Open ${project.title} project`);
      button.addEventListener('click',()=>run(`open ${project.id}`));list.append(button);
    }
    output.append(list);
  }
  function open({keyboard=false}={}){
    cancelHold();if(active||disposed||page.hidden||!isAvailable())return;
    onEnter?.();active=true;display.dataset.shell='true';
    work.hidden=true;pagination.hidden=true;screen.hidden=false;exit.hidden=false;
    trigger.textContent='~/playground';trigger.setAttribute('aria-expanded','true');
    announcement.textContent='JavaScript terminal.';
    input.value='';historyIndex=history.length;draft='';welcome();
    if(!reducedMotion.matches){motion?.cancel();motion=screen.animate([{opacity:0,offset:0},{opacity:0,offset:.18},{opacity:1}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});}
    if(keyboard&&canType())input.focus({preventScroll:true});
    else trigger.focus({preventScroll:true});
    onChange?.();
  }
  function close({restore=true}={}){
    cancelHold();if(!active)return;
    if(page.activeElement===input)input.blur?.();
    active=false;busy=false;runSequence++;playground?.destroy();playground=null;motion?.cancel();motion=null;
    delete display.dataset.shell;screen.removeAttribute('aria-busy');screen.hidden=true;exit.hidden=true;
    trigger.setAttribute('aria-expanded','false');input.value='';
    if(restore){onExit?.();trigger.focus({preventScroll:true});}
    onChange?.();
  }
  function run(value){
    if(!active||disposed)return;
    const command=parseTerminalCommand(value);if(command.type==='empty')return;
    const normalized=String(value).trim().toLowerCase();
    history.push(String(value).trim().slice(0,2000));if(history.length>12)history.shift();
    historyIndex=history.length;draft='';input.value='';
    if(normalized==='clear'){runSequence++;if(busy)playground?.reset();busy=false;screen.removeAttribute('aria-busy');output.replaceChildren();output.dataset.kind='console';return;}
    if(normalized==='reset'){runSequence++;playground?.reset();busy=false;screen.removeAttribute('aria-busy');welcome();return;}
    switch(command.type){
      case 'ls':listProjects();return;
      case 'whoami':response('Just me, Sami.\nI design and build everything here.');return;
      case 'help':response('JavaScript REPL\nclear / reset / ls / whoami / exit');return;
      case 'open':close({restore:false});onOpenProject?.(command.id);return;
      case 'exit':close();return;
    }
    if(!value||String(value).length>2000){response('Keep commands under 2,000 characters.');return;}
    if(busy){append('Still running. Type reset to stop it.','error');return;}
    if(output.dataset.kind!=='console')output.replaceChildren();
    append('> '+value,'input');
    const token=++runSequence;busy=true;playground??=makePlayground();screen.setAttribute('aria-busy','true');
    return playground.run(String(value)).then(records=>{
      if(!active||disposed||token!==runSequence)return;
      for(const record of records)append(record.text,record.kind);
    }).catch(()=>{if(active&&token===runSequence)append('Something interrupted execution. Try reset.','error');})
      .finally(()=>{if(token===runSequence){busy=false;screen.removeAttribute('aria-busy');}});
  }
  listen(trigger,'pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false||active||display.dataset.view!=='work'||!isAvailable())return;
    cancelHold();hold={id:event.pointerId,x:event.clientX,y:event.clientY};trigger.dataset.holding='true';
    holdTimer=setTimer(()=>open(),700);
  },{passive:true});
  listen(trigger,'pointermove',event=>{
    if(hold&&event.pointerId===hold.id&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>8)cancelHold();
  },{passive:true});
  for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])listen(trigger,event,cancelHold,{passive:true});
  // Native keyboard activation and assistive clicks have no pointer detail.
  listen(trigger,'click',event=>{if(event.detail===0&&display.dataset.view==='work'){event.preventDefault();open({keyboard:true});}});
  listen(trigger,'contextmenu',event=>{if(hold||active)event.preventDefault();});
  listen(page,'keydown',event=>{
    if(event.isComposing)return;
    if(active&&event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='`'||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.target?.closest('input,textarea,select,[contenteditable]'))return;
    if(!active&&isAvailable()){event.preventDefault();open({keyboard:true});}
  });
  listen(page,'visibilitychange',cancelHold);
  listen(page.defaultView,'blur',cancelHold);
  listen(exit,'click',()=>close());
  listen(form,'submit',event=>{event.preventDefault();run(input.value);if(active&&canType())input.focus({preventScroll:true});});
  listen(input,'keydown',event=>{
    if(event.isComposing||!['ArrowUp','ArrowDown'].includes(event.key)||!history.length)return;
    event.preventDefault();if(historyIndex===history.length)draft=input.value;
    historyIndex=Math.max(0,Math.min(history.length,historyIndex+(event.key==='ArrowUp'?-1:1)));
    input.value=historyIndex===history.length?draft:history[historyIndex];
  });
  return {open,close,run,get isOpen(){return active;},destroy(){close({restore:false});disposed=true;bindings.forEach(remove=>remove());}};
}
