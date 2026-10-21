const sheet=document.querySelector('.detail-sheet');
const trigger=document.querySelector('.detail-pill');
trigger?.addEventListener('click',()=>{sheet.showModal();trigger.setAttribute('aria-expanded','true')});
document.querySelector('.sheet-close')?.addEventListener('click',()=>sheet.close());
sheet?.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)sheet.close()}});
document.querySelectorAll('[data-level]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-level]').forEach(el=>{const selected=el===button;el.setAttribute('aria-checked',String(selected));const mark=el.querySelector('.selection-mark');if(mark)mark.textContent=selected?'✓':''});
 const value=document.querySelector('#chosen-level');if(value)value.textContent=button.dataset.level;
 const example=document.querySelector('.chosen-example');if(example)example.src='examples/'+button.dataset.level.toLowerCase()+'.webp';
 if(sheet?.open)sheet.close();
}));
document.querySelectorAll('.paper-color-option input').forEach(input=>input.addEventListener('change',()=>document.querySelectorAll('.paper-color-dot').forEach(dot=>{dot.textContent=dot.previousElementSibling.checked?'✓':''})));
document.querySelectorAll('form').forEach(form=>form.addEventListener('submit',e=>e.preventDefault()));
if(new URLSearchParams(location.search).has('open'))sheet?.showModal();

sheet?.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));
if(sheet?.open)trigger.setAttribute('aria-expanded','true');
