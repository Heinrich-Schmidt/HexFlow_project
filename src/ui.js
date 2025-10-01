export function rowRangeNumber(container, id, cfg, onChange){
  const wrap = document.createElement('div'); wrap.className='row';
  const label = document.createElement('label'); label.textContent = cfg.label; label.htmlFor = id;
  const range=document.createElement('input'); range.type='range';
  range.id=id; range.min=cfg.min; range.max=cfg.max; range.step=cfg.step; range.value=cfg.value;
  const num=document.createElement('input'); num.type='number';
  num.id=id+'-n'; num.min=cfg.min; num.max=cfg.max; num.step=cfg.step; num.value=cfg.value;
  wrap.append(label, range, num); container.appendChild(wrap);
  const apply = (v)=>{ const vv=Math.max(+cfg.min, Math.min(+cfg.max, +v)); range.value=num.value=vv; cfg.value=vv; onChange && onChange(id); };
  range.addEventListener('input', ()=>apply(range.value));
  num.addEventListener('input', ()=>apply(num.value));
  return {range,num,apply};
}
export function rowSelect(container, id, cfg, onChange){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=cfg.label; label.htmlFor=id;
  const sel=document.createElement('select'); sel.id=id;
  cfg.options.forEach(opt=>{ const o=document.createElement('option'); o.value=opt; o.textContent=opt; sel.appendChild(o); });
  sel.value=cfg.value;
  wrap.append(label, sel); container.appendChild(wrap);
  sel.addEventListener('change', ()=>{ cfg.value=sel.value; onChange && onChange(id); });
  return {select:sel};
}
export function rowCheckbox(container, id, cfg, onChange){
  const wrap=document.createElement('div'); wrap.className='row';
  const label=document.createElement('label'); label.textContent=cfg.label; label.htmlFor=id;
  const cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.checked=!!cfg.value;
  wrap.append(label, cb); container.appendChild(wrap);
  cb.addEventListener('change', ()=>{ cfg.value=cb.checked; onChange && onChange(id); });
  return {checkbox:cb};
}
