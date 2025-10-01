// src/ui.js
export function rowRange(container, id, label, min, max, step, value, onChange){
  const wrap=document.createElement('div'); wrap.className='row';
  const lab=document.createElement('label'); lab.textContent=label; lab.htmlFor=id;
  const r=document.createElement('input'); r.type='range'; r.id=id; r.min=min; r.max=max; r.step=step; r.value=value;
  const n=document.createElement('input'); n.type='number'; n.min=min; n.max=max; n.step=step; n.value=value;
  wrap.append(lab,r,n); container.appendChild(wrap);
  const apply=v=>{ r.value=n.value=v; onChange(+v); };
  r.addEventListener('input',()=>apply(r.value));
  n.addEventListener('input',()=>apply(n.value));
  return {wrap, apply};
}
export function rowSelect(container, id, label, options, value, onChange){
  const wrap=document.createElement('div'); wrap.className='row';
  const lab=document.createElement('label'); lab.textContent=label; lab.htmlFor=id;
  const s=document.createElement('select'); s.id=id; options.forEach(o=>{ const opt=document.createElement('option'); opt.value=o; opt.textContent=o; s.appendChild(opt); }); s.value=value;
  wrap.append(lab,s); container.appendChild(wrap); s.addEventListener('change',()=>onChange(s.value));
  return {wrap};
}
export function rowCheckbox(container, id, label, value, onChange){
  const wrap=document.createElement('div'); wrap.className='row';
  const lab=document.createElement('label'); lab.textContent=label; lab.htmlFor=id;
  const c=document.createElement('input'); c.type='checkbox'; c.id=id; c.checked=!!value;
  wrap.append(lab,c); container.appendChild(wrap); c.addEventListener('change',()=>onChange(c.checked));
  return {wrap};
}
export function rowColor(container, id, label, value, onChange){
  const wrap=document.createElement('div'); wrap.className='row';
  const lab=document.createElement('label'); lab.textContent=label; lab.htmlFor=id;
  const c=document.createElement('input'); c.type='color'; c.value=value;
  wrap.append(lab,c); container.appendChild(wrap); c.addEventListener('input',()=>onChange(c.value));
  return {wrap};
}
export function rowButton(container, text, onClick){
  const wrap=document.createElement('div'); wrap.className='row';
  const b=document.createElement('button'); b.className='btn'; b.textContent=text; b.addEventListener('click',onClick);
  wrap.append(b); container.appendChild(wrap); return {wrap, button:b};
}
