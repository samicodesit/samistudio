import assert from 'node:assert/strict';
import {test} from 'node:test';
import {terminalParts} from '../assets/terminal-assembly.mjs';
import {layerPose} from '../assets/terminal-construction.mjs';
import {parseTerminalCommand} from '../assets/secret-terminal.mjs';

test('the five functional assemblies have unique identifiers and useful descriptions',()=>{
  assert.equal(terminalParts.length,5);
  assert.equal(new Set(terminalParts.map(p=>p.id)).size,5);
  for(const p of terminalParts){assert.ok(p.title.length>3);assert.ok(p.description.length>30);}
});
test('separation is bounded, deterministic, reversible and follows a common mounting axis',()=>{
  for(const p of terminalParts){
    assert.deepEqual(layerPose(p.id,0),{x:0,y:0});
    assert.deepEqual(layerPose(p.id,-1),layerPose(p.id,0));
    assert.deepEqual(layerPose(p.id,2),layerPose(p.id,1));
    assert.deepEqual(layerPose(p.id,NaN),{x:0,y:0});
    assert.deepEqual(layerPose(p.id,Infinity),{x:0,y:0});
    const full=layerPose(p.id,1),half=layerPose(p.id,.5);assert.equal(half.x,full.x*.5);assert.equal(half.y,full.y*.5);
    layerPose(p.id,1);assert.deepEqual(layerPose(p.id,0),{x:0,y:0});
  }
  assert.throws(()=>layerPose('invalid',.5),/Unknown/);
});
test('assemblies separate in their mounting order without swapping sides',()=>{
  for(let i=1;i<terminalParts.length;i++){
    const back=terminalParts[i-1],front=terminalParts[i];
    assert.ok(layerPose(front.id,1).x>layerPose(back.id,1).x);
  }
});
test('explode is an explicit portfolio command with whitespace and case normalization',()=>{
  assert.deepEqual(parseTerminalCommand('  EXPLODE  '),{type:'explode'});
  assert.equal(parseTerminalCommand('explode extra').type,'unknown');
});
