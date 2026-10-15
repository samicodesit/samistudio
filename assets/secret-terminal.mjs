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
  canType=()=>true,onEnter,onExit,onOpenProject,onChange,setTimer=setTimeout,clearTimer=clearTimeout}) {
  const trigger=display.querySelector('#display-title');
  const screen=display.querySelector('.screen-shell');
  const output=display.querySelector('.shell-output');
  const actions=display.querySelector('.shell-actions');
  const form=display.querySelector('.shell-form');
  const input=display.querySelector('.shell-input');
  const exit=display.querySelector('.shell-exit');
  const pagination=display.querySelector('.display-pagination');
  const work=display.querySelector('.screen-work');
  const announcement=display.querySelector('#display-announcement');
  const bindings=[],history=[];
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
  function listProjects(welcome=false){
    response(welcome?'Found it. Pick a project.':'Three projects. Take a look.');
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
    trigger.textContent='~/studio';trigger.setAttribute('aria-expanded','true');
    announcement.textContent='Secret terminal. Choose a command or a project.';
    input.value='';historyIndex=history.length;draft='';listProjects(true);
    if(!reducedMotion.matches){motion?.cancel();motion=screen.animate([{opacity:.25},{opacity:1}],{duration:160,easing:'ease-out'});}
    if(keyboard&&canType())input.focus({preventScroll:true});
    else actions.querySelectorAll('[data-command]')[0]?.focus({preventScroll:true});
    onChange?.();
  }
  function close({restore=true}={}){
    cancelHold();if(!active)return;
    active=false;motion?.cancel();motion=null;
    delete display.dataset.shell;screen.hidden=true;exit.hidden=true;
    trigger.setAttribute('aria-expanded','false');input.value='';
    if(restore){onExit?.();trigger.focus({preventScroll:true});}
    onChange?.();
  }
  function run(value){
    if(!active||disposed)return;
    const command=parseTerminalCommand(value);if(command.type==='empty')return;
    history.push(String(value).trim().slice(0,80));if(history.length>12)history.shift();
    historyIndex=history.length;draft='';input.value='';
    switch(command.type){
      case 'ls':listProjects();break;
      case 'whoami':response('Just me, Sami.\nI design and build everything here.');break;
      case 'help':response(canType()?'ls · projects\nopen <project> · take a look\nwhoami · about me':'ls · pick a project\nwhoami · about me\nexit · back to Work');break;
      case 'open':close({restore:false});onOpenProject?.(command.id);return;
      case 'exit':close();return;
      default:response('Unknown command. Try help.');
    }
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
  for(const button of actions.querySelectorAll('[data-command]'))listen(button,'click',()=>run(button.dataset.command));
  listen(form,'submit',event=>{event.preventDefault();run(input.value);});
  listen(input,'keydown',event=>{
    if(event.isComposing||!['ArrowUp','ArrowDown'].includes(event.key)||!history.length)return;
    event.preventDefault();if(historyIndex===history.length)draft=input.value;
    historyIndex=Math.max(0,Math.min(history.length,historyIndex+(event.key==='ArrowUp'?-1:1)));
    input.value=historyIndex===history.length?draft:history[historyIndex];
  });
  return {open,close,run,get isOpen(){return active;},destroy(){close({restore:false});disposed=true;bindings.forEach(remove=>remove());}};
}
