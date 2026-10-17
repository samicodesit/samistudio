const storageKey='sami-studio-motion';

export function createMotionPreference(media,storage){
  const events=new EventTarget();
  let choice=null;
  try{const value=storage?.getItem(storageKey);if(value==='reduce'||value==='full')choice=value;}catch{}
  const preference={
    get matches(){return choice?choice==='reduce':media.matches;},
    get choice(){return choice;},
    addEventListener:(...args)=>events.addEventListener(...args),
    removeEventListener:(...args)=>events.removeEventListener(...args),
    set(value){
      const previous=preference.matches;
      choice=value==='reduce'||value==='full'?value:null;
      try{if(choice)storage?.setItem(storageKey,choice);else storage?.removeItem(storageKey);}catch{}
      if(previous!==preference.matches)events.dispatchEvent(new Event('change'));
    },
  };
  media.addEventListener('change',()=>{if(!choice)events.dispatchEvent(new Event('change'));});
  return preference;
}

let storage;try{storage=globalThis.localStorage;}catch{}
export const motionPreference=typeof matchMedia==='function'
  ?createMotionPreference(matchMedia('(prefers-reduced-motion: reduce)'),storage):null;

if(typeof document!=='undefined'&&motionPreference){
  const controls=[];
  function render(){
    document.documentElement.dataset.motion=motionPreference.matches?'reduce':'full';
    for(const button of controls){
      button.setAttribute('aria-pressed',String(!motionPreference.matches));
      button.dataset.state=motionPreference.matches?'off':'on';
      button.title=motionPreference.matches?'Motion reduced. Enable full motion':'Motion on. Use gentle fades instead';
    }
  }
  function mount(parent){
    const button=document.createElement('button');button.className='motion-control';button.type='button';
    button.setAttribute('aria-label','Motion');
    button.setAttribute('aria-description','Turn off camera movement and use gentle fades.');
    button.innerHTML='<span class="motion-label">Motion</span><svg class="motion-glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 5.5h4.5a2.5 2.5 0 1 0-2.35-3.35M2 8h10a2.5 2.5 0 1 1-2.35 3.35M2 10.5h3.5"/><path class="motion-slash" d="m2 2 12 12"/></svg>';
    button.addEventListener('click',()=>motionPreference.set(motionPreference.matches?'full':'reduce'));
    controls.push(button);
    parent.append(button);
  }
  mount(document.body);
  motionPreference.addEventListener('change',render);render();
}
