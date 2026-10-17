// User JavaScript only runs in a disposable worker inside an opaque-origin frame.
export function playgroundWorker() {
  self.onmessage=bootstrap=>{
  const port=bootstrap.ports?.[0];if(!port)return;self.onmessage=null;
  const send=port.postMessage.bind(port), evaluate=(0,eval), AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  let current=0,lines=0;
  // No detached jobs or child workers may outlive the bounded evaluation.
  self.setInterval=undefined;self.setTimeout=undefined;self.Worker=undefined;self.SharedWorker=undefined;
  function inspect(value,depth=0,seen=new Set()) {
    if(typeof value==='string')return JSON.stringify(value.length>800?value.slice(0,800)+'...':value);
    if(value===null)return 'null';
    if(typeof value!=='object')return String(value);
    if(seen.has(value))return '[Circular]';
    if(depth>2)return Array.isArray(value)?'[...]':'{...}';
    seen.add(value);
    try {
      if(value instanceof Error)return value.name+': '+value.message;
      const keys=Object.keys(value).slice(0,12);
      return Array.isArray(value)?'['+keys.map(k=>inspect(value[k],depth+1,seen)).join(', ')+']'
        :'{'+keys.map(k=>k+': '+inspect(value[k],depth+1,seen)).join(', ')+'}';
    }catch{return '[Uninspectable]';}
    finally{seen.delete(value);}
  }
  const record=(kind,text)=>{if(lines++<32||kind==='result'||kind==='error')send({id:current,kind,text:String(text).slice(0,1000)});};
  for(const method of ['log','info','warn','error','table','dir'])self.console[method]=(...args)=>record(method==='error'?'log-error':'log',args.map(a=>typeof a==='string'?a:inspect(a)).join(' '));
  port.onmessage=async event=>{
    const {id,code}=event.data||{};if(!Number.isSafeInteger(id)||typeof code!=='string'||code.length>2000)return;
    current=id;lines=0;
    try{
      let value;
      try{value=evaluate(code);}catch(error){
        if(error.name!=='SyntaxError'||!code.includes('await'))throw error;
        let fn;try{fn=new AsyncFunction('return ('+code+'\n)');}catch{fn=new AsyncFunction(code);}
        value=fn();
      }
      value=await value;record('result',inspect(value));
    }catch(error){record('error',(error?.name||'Error')+': '+(error?.message||String(error)));}
  };
  port.start();
  };
}
function playgroundFrame(workerCode) {
  const send=parent.postMessage.bind(parent);let worker,url,channel,forwarded=0;
  function reset(){worker?.terminate();channel?.port1.close();if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'}));worker=new Worker(url);channel=new MessageChannel();worker.postMessage({},[channel.port2]);forwarded=0;
    channel.port1.onmessage=event=>{const m=event.data;if(!m||!Number.isSafeInteger(m.id)||!['log','log-error','result','error'].includes(m.kind)||typeof m.text!=='string'||forwarded++>36)return;send({id:m.id,kind:m.kind,text:m.text.slice(0,1000)},'*');};
    worker.onerror=()=>{worker.terminate();send({kind:'failed'},'*');};
  }
  addEventListener('message',event=>{if(event.source!==parent)return;const m=event.data||{};
    if(m.kind==='dispose'){worker?.terminate();channel?.port1.close();if(url)URL.revokeObjectURL(url);return;}
    if(m.kind==='reset'){try{reset();send({kind:'ready'},'*');}catch{send({kind:'failed'},'*');}return;}
    if(m.kind==='run'&&Number.isSafeInteger(m.id)&&typeof m.code==='string'&&m.code.length<=2000){forwarded=0;channel.port1.postMessage({id:m.id,code:m.code});}
  });
  try{reset();send({kind:'ready'},'*');}catch{send({kind:'failed'},'*');}
}
export function playgroundDocument(){
  const worker='('+playgroundWorker.toString()+')()';
  const boot='('+playgroundFrame.toString()+')('+JSON.stringify(worker)+')';
  return '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' blob:; worker-src blob:; connect-src \'none\'; child-src \'none\'; form-action \'none\'; base-uri \'none\'"><script>'+boot.replaceAll('</script','<\\/script')+'</script>';
}
export function createPlayground({page=document,setTimer=setTimeout,clearTimer=clearTimeout,timeoutMs=1500}={}){
  let frame=null,ready=false,pending=null,sequence=0,timer=0,dead=false;
  const post=message=>frame?.contentWindow?.postMessage(message,'*');
  function finish(record){if(!pending)return;clearTimer(timer);timer=0;const job=pending;pending=null;if(record)job.records.push(record);job.resolve(job.records);}
  function receive(event){
    if(!frame||event.source!==frame.contentWindow)return;
    const m=event.data||{};
    if(m.kind==='ready'){ready=true;if(pending)post({kind:'run',id:pending.id,code:pending.code});return;}
    if(m.kind==='failed'){ready=false;finish({kind:'error',text:'JavaScript is unavailable in this browser.'});return;}
    if(!pending||m.id!==pending.id||typeof m.text!=='string'||!['log','log-error','result','error'].includes(m.kind))return;
    if(pending.records.length<33)pending.records.push({kind:m.kind,text:m.text.slice(0,1000)});
    if(m.kind==='result'||m.kind==='error')finish();
  }
  function ensureFrame(){if(frame)return;frame=page.createElement('iframe');frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('title','Isolated JavaScript playground');frame.setAttribute('referrerpolicy','no-referrer');frame.srcdoc=playgroundDocument();page.body.append(frame);}
  page.defaultView.addEventListener('message',receive);
  return {
    run(code){
      if(dead)return Promise.resolve([]);
      if(pending)return Promise.resolve([{kind:'error',text:'Still running. Tap reset to stop it.'}]);
      if(typeof code!=='string'||code.length>2000)return Promise.resolve([{kind:'error',text:'Keep commands under 2,000 characters.'}]);
      ensureFrame();return new Promise(resolve=>{pending={id:++sequence,code,resolve,records:[]};timer=setTimer(()=>{post({kind:'reset'});finish({kind:'error',text:'Stopped after 1.5 seconds. Playground reset.'});},timeoutMs);if(ready)post({kind:'run',id:pending.id,code});});
    },
    reset(){post({kind:'reset'});finish({kind:'error',text:'Execution stopped. Fresh playground.'});},
    destroy(){if(dead)return;dead=true;post({kind:'dispose'});finish();page.defaultView.removeEventListener('message',receive);frame?.remove();frame=null;}
  };
}
