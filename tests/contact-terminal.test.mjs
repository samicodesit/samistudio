import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contactDraft,contactMailto,openContactEmail,initContactTerminal} from '../assets/contact-terminal.mjs';
const valid={name:'Alex',email:'alex@example.com',message:'A small site for a good idea.'};
test('contact values are validated and whitespace-only enquiries cannot be sent',()=>{
 assert.deepEqual(contactDraft({...valid,name:' Alex ',email:' alex@example.com ',message:' Hello '}),{name:'Alex',email:'alex@example.com',message:'Hello'});
 for(const values of [{...valid,name:' '},{...valid,email:'alex@'},{...valid,message:' '},{...valid,message:'x'.repeat(4001)}])assert.throws(()=>contactDraft(values));
});
test('email drafts preserve punctuation and line breaks without injecting extra recipients or headers',()=>{
 const values={name:'Alex\r\nBcc: not-a-header',email:'alex+studio@example.com',message:'A&B? 100% ready.\n<script>text only</script>'};
 const url=new URL(contactMailto(values));assert.equal(url.protocol,'mailto:');assert.equal(url.pathname,'hello@samistudio.nl');
 assert.equal(url.searchParams.get('subject'),'Something needs doing: Alex Bcc: not-a-header');
 assert.equal(url.searchParams.get('body'),`Hi Sami,\n\n${values.message}\n\n${values.name}\n${values.email}`);
 assert.equal([...url.searchParams].length,2);
});
test('the existing email-app transport creates a draft and never reports it as a sent email',()=>{
 let href,clicks=0;const page={createElement:()=>({set href(value){href=value;},click(){clicks++;}})};
 assert.deepEqual(openContactEmail(valid,{page}),{delivery:'email-app'});assert.equal(clicks,1);assert.equal(new URL(href).pathname,'hello@samistudio.nl');
});

function contactFixture(){
 const events=new Map();let focused;
 const element=()=>({dataset:{phase:'closed'},style:{setProperty(){},removeProperty(){}},attrs:{},listeners:new Map(),
  setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
  addEventListener(k,fn){this.listeners.set(k,fn);},removeEventListener(k){this.listeners.delete(k);},
  focus(){focused=this;},blur(){focused=null;},isConnected:true,getClientRects(){return [1];},getBoundingClientRect(){return {left:0,top:0,width:400,height:300};}});
 const top=element(),screen=element(),dialog=element(),panel=element(),lcd=element(),form=element(),status=element(),submit=element(),close=element(),heading=element();
 const nodes={'.contact-monitor':panel,'.contact-lcd':lcd,form,'.contact-status':status,'.contact-close':close,h2:heading};
 dialog.querySelector=s=>nodes[s];dialog.querySelectorAll=()=>[];dialog.contains=e=>e===heading;
 dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 form.querySelector=()=>submit;
 const view={getComputedStyle:()=>({transform:'none',opacity:'1'}),Image:class{decode(){return Promise.resolve();}},location:{hash:'',pathname:'/',search:''},history:{state:null,pushState(state,_,hash){this.state=state;view.location.hash=hash;},replaceState(){},back(){}},
  addEventListener(k,fn){events.set(k,fn);},removeEventListener(k){events.delete(k);}};
 const page={defaultView:view,body:element(),get activeElement(){return focused;},querySelector:s=>s==='[data-contact-entry]'?top:dialog,querySelectorAll:()=>[top,screen]};
 const controller=initContactTerminal({page,reducedMotion:{matches:true,addEventListener(){},removeEventListener(){}}});
 return {top,screen,dialog,form,view,controller,get focused(){return focused;}};
}

test('the screen CTA opens the existing contact dialog and closing returns focus to that CTA',async()=>{
 const f=contactFixture();let prevented=false;
 assert.ok(f.screen.listeners.has('click'),'both contact entry points must be bound');
 f.screen.listeners.get('click')({preventDefault(){prevented=true;}});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(prevented,true);assert.equal(f.dialog.open,true);assert.equal(f.view.location.hash,'#contact');
 f.view.location.hash='';await f.controller.close();
 assert.equal(f.dialog.open,false);assert.equal(f.focused,f.screen);
 f.controller.destroy();
});

test('modified clicks keep the email fallback and repeated activation cannot open a second contact dialog',async()=>{
 const f=contactFixture();let prevented=0;
 assert.ok(f.screen.listeners.has('click'),'screen entry must share the contact controller');
 f.screen.listeners.get('click')({ctrlKey:true,preventDefault(){prevented++;}});
 assert.equal(prevented,0);assert.equal(f.dialog.open,undefined);
 f.screen.listeners.get('click')({preventDefault(){prevented++;}});
 f.top.listeners.get('click')({preventDefault(){prevented++;}});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(f.dialog.open,true);assert.equal(f.dialog.dataset.phase,'open');
 assert.equal(f.top.attrs['aria-busy'],undefined);assert.equal(f.screen.attrs['aria-busy'],undefined);
 f.controller.destroy();
});
