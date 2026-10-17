import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {playgroundDocument, playgroundWorker, createPlayground} from '../assets/javascript-playground.mjs';

function runtime(){
 const messages=[]; const context=vm.createContext({postMessage:m=>messages.push(m),console:{},setTimeout,clearTimeout});
 vm.runInContext('self=globalThis;',context); vm.runInContext('('+playgroundWorker.toString()+')()',context);
 const port={postMessage:m=>messages.push(m),start(){}};context.onmessage({ports:[port]});
 return {messages,async run(code,id=1){await port.onmessage({data:{id,code}});return messages.filter(m=>m.id===id);}};
}
test('playground executes JavaScript, preserves var state, captures logs and resolves promises',async()=>{
 const r=runtime(); assert.equal((await r.run('2 ** 10'))[0].text,'1024');
 await r.run('var answer = 41',2);assert.equal((await r.run('answer + 1',3))[0].text,'42');
 const output=await r.run('console.log("hello", {n:2}); Promise.resolve([1,2,3])',4);
 assert.deepEqual(output.map(m=>m.kind),['log','result']);assert.match(output[0].text,/hello.*n.*2/);assert.equal(output[1].text,'[1, 2, 3]');
 assert.equal((await r.run('await Promise.resolve(7)',5))[0].text,'7');
});
test('syntax and runtime failures are visible, not inserted as markup',async()=>{
 const r=runtime();assert.match((await r.run('throw new Error("oops")'))[0].text,/Error: oops/);
 assert.equal((await r.run('"<img onerror=alert(1)>"',2))[0].text,'"<img onerror=alert(1)>"');
 assert.equal((await r.run('typeof document',3))[0].text,'"undefined"');
 assert.match((await r.run('const =',4))[0].text,/SyntaxError/);
});
test('output handles circular objects and bounds long strings and noisy console output',async()=>{
 const r=runtime();const out=await r.run('var a={}; a.self=a; a');assert.match(out[0].text,/Circular/);
 assert.ok((await r.run('"x".repeat(100000)',2))[0].text.length<=1000);
 assert.ok((await r.run('for(var i=0;i<10000;i++)console.log(i)',3)).length<=33);
});
test('sandbox document blocks network, frames and external scripts while keeping evaluation inside an opaque worker',()=>{
 const html=playgroundDocument();assert.match(html,/default-src 'none'/);assert.match(html,/connect-src 'none'/);assert.match(html,/worker-src blob:/);assert.match(html,/worker\?\.terminate/);assert.match(html,/event.source!==parent/);
});
function bridge(){
 const events=new Map(),timers=new Map();let n=0;const sent=[];const frame={hidden:false,setAttribute(k,v){this[k]=v},contentWindow:{postMessage:m=>sent.push(m)},remove(){this.removed=true}};
 const page={createElement:()=>frame,body:{append(){}},defaultView:{addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)}};
 const engine=createPlayground({page,setTimer:f=>{timers.set(++n,f);return n},clearTimer:id=>timers.delete(id)});
 return{engine,frame,sent,timers,events,emit(data,source=frame.contentWindow){events.get('message')?.({source,data})}};
}
test('bridge ignores foreign messages, times out and resets, then disposes pending work',async()=>{
 const b=bridge();const result=b.engine.run('2+2');b.emit({kind:'ready'});const id=b.sent.find(m=>m.kind==='run').id;
 b.emit({id,kind:'result',text:'forged'},{});assert.equal(b.timers.size,1);
 b.emit({id,kind:'result',text:'4'});assert.equal((await result).at(-1).text,'4');assert.equal(b.timers.size,0);
 const pending=b.engine.run('while(true){}');[...b.timers.values()][0]();assert.match((await pending).at(-1).text,/stopped/i);assert.equal(b.sent.at(-1).kind,'reset');
 const last=b.engine.run('1');b.engine.destroy();await last;assert.equal(b.frame.removed,true);assert.equal(b.events.size,0);assert.equal(b.timers.size,0);
});


test('user code cannot replace the private runner or forge completion through the worker global channel',async()=>{
 const r=runtime();await r.run('self.onmessage=()=>{}; self.postMessage({id:99,kind:"result",text:"fake"})',1);
 assert.equal((await r.run('40+2',2)).at(-1).text,'42');
});
