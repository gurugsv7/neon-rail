// Kenney's atlas columns are gradients, so one visual material shows up as a
// dozen near-identical swatches (#bdc6ee, #bbc3ea, #bac3ea ... are all the same
// lavender). Mapping swatch-by-swatch would explode the material count and lose
// the lightness variation that gives these low-poly models their form.
// Instead: keep each swatch's LIGHTNESS -- that is the model's shading -- and
// replace its hue/saturation with the game's own. Lightness is quantised so the
// material count stays bounded no matter how many swatches a model samples.
const LEVELS=6;
function toHsl(hex){
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;
  if(!d)return {h:0,s:0,l};
  const s=l>.5?d/(2-max-min):d/(max+min);
  let h;if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;
  return {h,s,l};
}
function toHex({h,s,l}){
  const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);
    return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
  return (f(0)<<16)|(f(8)<<8)|f(4);
}
// Hue families the kit actually uses, and what each becomes in NEON RAIL.
// `lift` and `range` remap Kenney's lightness band onto the game's.
const FAMILIES=[
  {name:'amber', test:c=>c.s>.35&&(c.h<.12||c.h>.95), h:.075,s:.72,lift:.34,range:.42},
  {name:'green', test:c=>c.s>.3&&c.h>=.28&&c.h<=.52,  h:.24, s:.42,lift:.30,range:.34},
  {name:'metal', test:()=>true,                        h:.47, s:.10,lift:.24,range:.50},
];
export function family(hex){const c=toHsl(hex);return FAMILIES.find(f=>f.test(c)).name;}
// A model may need a family steered somewhere specific -- Kenney's green
// dumpster and orange utility poles are the game's teal street furniture, not
// green and orange. An override supplies the hue and saturation; the lightness
// ramp is still the model's own, so its shading survives.
export function recolour(hex,overrides){
  const c=toHsl(hex),f=FAMILIES.find(fam=>fam.test(c));
  const target=overrides&&overrides[f.name];
  const t=target!==undefined?toHsl('#'+target.toString(16).padStart(6,'0')):null;
  // Quantise first so near-identical swatches collapse onto one material.
  const step=Math.round(c.l*(LEVELS-1))/(LEVELS-1);
  return toHex({h:t?t.h:f.h,s:t?t.s:f.s,l:f.lift+step*f.range});
}
