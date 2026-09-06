import { describe, it, expect } from "vitest";
function partition<T extends {hidden:boolean; type:string}>(cats:T[], filter:string) {
  const filtered = filter==="all"?cats:cats.filter(c=>c.type===filter);
  return { visible: filtered.filter(c=>!c.hidden), hidden: filtered.filter(c=>c.hidden) };
}
describe("partition", ()=>{
  it("splits visible/hidden per filter", ()=>{
    const cats=[{type:"expense",hidden:false},{type:"expense",hidden:true},{type:"income",hidden:false}] as any;
    expect(partition(cats,"all").visible.length).toBe(2);
    expect(partition(cats,"expense").hidden.length).toBe(1);
  });
});
