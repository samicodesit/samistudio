import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMotionPreference} from '../assets/motion-preferences.mjs';
function media(matches){const events=new EventTarget();return{matches,addEventListener:(...args)=>events.addEventListener(...args),change(value){this.matches=value;events.dispatchEvent(new Event('change'));}};}
test('system preference is the default and follows changes',()=>{const os=media(true),p=createMotionPreference(os);assert.equal(p.matches,true);os.change(false);assert.equal(p.matches,false);});
test('explicit choice persists and can reset to system',()=>{const state=new Map(),storage={getItem:k=>state.get(k),setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)};const os=media(false),p=createMotionPreference(os,storage);p.set('reduce');assert.equal(p.matches,true);assert.equal(createMotionPreference(os,storage).matches,true);p.set(null);assert.equal(p.matches,false);});
test('blocked storage does not break preference or notifications',()=>{const p=createMotionPreference(media(false),{getItem(){throw Error('denied');},setItem(){throw Error('denied');}});let n=0;p.addEventListener('change',()=>n++);p.set('reduce');p.set('reduce');assert.equal(p.matches,true);assert.equal(n,1);});
test('a deliberate choice is preserved when the OS changes',()=>{const os=media(false),p=createMotionPreference(os);p.set('full');os.change(true);assert.equal(p.matches,false);});
