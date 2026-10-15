import assert from 'node:assert/strict';
import {test} from 'node:test';
import {KeySpring} from '../assets/key-spring.mjs';

const settle=spring=>{for(let i=0;i<240&&spring.moving;i++)spring.advance(1/120);assert.equal(spring.moving,false);};

test('a selected terminal key starts at its resting depth without an entrance stroke',()=>{
  const spring=new KeySpring(true);
  assert.equal(spring.position,1);
  assert.equal(spring.moving,false);
});

test('pressing the selected key has a small physical stroke and settles back to its selected depth',()=>{
  const spring=new KeySpring(true);
  spring.setPressed(true);settle(spring);
  assert.ok(spring.position>1&&spring.position<=1.3);
  spring.setPressed(false);settle(spring);
  assert.equal(spring.position,1);
});

test('changing selection during a stroke never jumps the key position',()=>{
  const spring=new KeySpring();
  spring.setPressed(true);spring.advance(.016);
  const before=spring.position;
  spring.setSelected(true);
  assert.equal(spring.position,before);
  spring.setPressed(false);
  assert.equal(spring.position,before);
  let previous=before;
  for(let i=0;i<240&&spring.moving;i++){
    const next=spring.advance(1/120);
    assert.ok(Math.abs(next-previous)<.3,'every frame follows the physical stroke');
    previous=next;
  }
  assert.equal(spring.position,1);
  spring.setSelected(false);assert.equal(spring.position,1);
  settle(spring);assert.equal(spring.position,0);
});

test('reduced-motion settling clears velocity and leaves no running spring',()=>{
  const spring=new KeySpring();spring.setPressed(true);spring.advance(.016);
  spring.finish();assert.equal(spring.position,spring.target);assert.equal(spring.moving,false);
  spring.setPressed(false);spring.finish();assert.equal(spring.position,0);
});
