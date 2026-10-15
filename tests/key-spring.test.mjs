import assert from 'node:assert/strict';
import {test} from 'node:test';
import {KeySpring} from '../assets/key-spring.mjs';

const settle=spring=>{for(let i=0;i<240&&spring.moving;i++)spring.advance(1/120);assert.equal(spring.moving,false);};

test('a selected terminal key starts at its resting depth without an entrance stroke',()=>{
  const spring=new KeySpring(true);
  assert.equal(spring.position,1);
  assert.equal(spring.moving,false);
});

test('pressing the selected key has a visible mechanical stroke and settles back to its selected depth',()=>{
  const spring=new KeySpring(true);
  spring.setPressed(true);settle(spring);
  assert.ok(spring.position>1&&spring.position<=1.65);
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


test('a press reaches its seat promptly and an active key still has perceptible travel',()=>{
  for(const selected of [false,true]){
    const spring=new KeySpring(selected),start=spring.position;
    spring.setPressed(true);
    for(let i=0;i<8;i++)spring.advance(1/120);
    assert.ok(spring.position>=1.5,'bottom-out is visible within 67ms');
    assert.ok(spring.position-start>=.5,'selected key has at least 1.5px of extra physical travel');
    let peak=spring.position;
    for(let i=0;i<40;i++){spring.advance(1/120);peak=Math.max(peak,spring.position);}
    assert.ok(peak<=1.66,'a rigid key cannot bounce beyond its socket');
    spring.setSelected(true);spring.setPressed(false);
    for(let i=0;i<30;i++)spring.advance(1/120);
    assert.ok(Math.abs(spring.position-1)<.002,'the key settles within 250ms');
  }
});

test('rapid interrupted strokes remain continuous at 30, 60 and 120Hz',()=>{
  for(const hz of [30,60,120]){
    const spring=new KeySpring();
    for(let cycle=0;cycle<20;cycle++){
      const before=spring.position;
      spring.setPressed(true);assert.equal(spring.position,before);
      spring.advance(1/hz);spring.setSelected(cycle%2===0);spring.setPressed(false);
      for(let j=0;j<3;j++){
        const value=spring.advance(1/hz);
        assert.ok(Number.isFinite(value)&&value>-.08&&value<1.68,'no jump beyond the physical travel range');
      }
    }
    settle(spring);
  }
});
