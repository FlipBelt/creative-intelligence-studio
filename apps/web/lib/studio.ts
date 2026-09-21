export type DemoRole = "employee" | "admin";
export type Audit = {at:string;action:string;note:string;actor:"admin";scores?:number[];factsChecked?:boolean};
export type Skill = {id:string;family:string;version:number;name:string;description:string;media:string;filename:string;content:string;createdAt:string;status:"pending"|"published"|"rejected"|"disabled";audit:Audit[]};
export type Work = {id:string;family:string;version:number;title:string;category:string;product:string;author:string;image:string;createdAt:string;status:"pending"|"published"|"rejected";scores:number[]|null;reason:string;factsChecked:boolean;audit:Audit[]};
export type Studio = {version:1;skills:Skill[];works:Work[];favorites:string[];threshold:number};
export const emptyStudio=():Studio=>({version:1,skills:[],works:[],favorites:[],threshold:4});
export function average(scores:number[]|null):number|null{return scores?.length===4?Math.round(scores.reduce((a,b)=>a+b,0)/4*10)/10:null;}
export function isFeatured(work:Work,threshold:number){const score=average(work.scores);return work.status==="published"&&work.factsChecked&&score!==null&&score>=threshold;}
export function reviewSkill(skills:Skill[],id:string,decision:"published"|"rejected"|"disabled",role:DemoRole,note:string,at:string):Skill[]{
 if(role!=="admin")throw new Error("仅管理员演示视角可审核");
 const target=skills.find(s=>s.id===id);if(!target)throw new Error("技能不存在");
 if(decision==="disabled"?target.status!=="published":target.status!=="pending")throw new Error("当前版本状态不支持此操作");
 if(decision==="published"&&skills.some(s=>s.family===target.family&&s.status==="published"&&s.version>target.version))throw new Error("已有更新版本发布，不能发布旧版本");
 if(!note.trim())throw new Error("请填写审核说明");
 return skills.map(s=>s.id===id?{...s,status:decision,audit:[...s.audit,{at,action:decision,note:note.trim(),actor:"admin"}]}:decision==="published"&&s.family===target.family&&s.status==="published"?{...s,status:"disabled",audit:[...s.audit,{at,action:"superseded",note:"已发布更新版本",actor:"admin"}]}:s);
}
export function reviewWork(work:Work,decision:"published"|"rejected",scores:number[],factsChecked:boolean,note:string,role:DemoRole,at:string):Work{
 if(role!=="admin")throw new Error("仅管理员演示视角可审核");
 if(!note.trim())throw new Error("请填写评分与审核理由");
 if(decision==="published"&&(!factsChecked||scores.length!==4||scores.some(n=>!Number.isInteger(n)||n<1||n>5)))throw new Error("请完成四项评分与事实检查");
 return {...work,status:decision,scores:decision==="published"?[...scores]:null,factsChecked:decision==="published"&&factsChecked,reason:note.trim(),audit:[...work.audit,{at,action:decision,note:note.trim(),actor:"admin",scores:decision==="published"?[...scores]:[],factsChecked:decision==="published"&&factsChecked}]};
}
export function decodeStudio(raw:string):Studio{
 const s=JSON.parse(raw);const str=(v:unknown)=>typeof v==="string";const audit=(a:any)=>Array.isArray(a)&&a.every(x=>x&&str(x.at)&&str(x.note)&&str(x.action)&&x.actor==="admin");
 if(!s||s.version!==1||!Array.isArray(s.skills)||!Array.isArray(s.works)||!Array.isArray(s.favorites)||!s.favorites.every(str)||!Number.isFinite(s.threshold)||s.threshold<1||s.threshold>5)throw new Error("本地资料无法读取");
 for(const k of s.skills)if(!k||![k.id,k.family,k.name,k.description,k.media,k.filename,k.content,k.createdAt].every(str)||!Number.isInteger(k.version)||k.version<1||!["pending","published","rejected","disabled"].includes(k.status)||!audit(k.audit))throw new Error("技能记录损坏");
 for(const w of s.works)if(!w||![w.id,w.family,w.title,w.category,w.product,w.author,w.image,w.createdAt,w.reason].every(str)||!/^data:image\/(png|jpeg|webp);base64,/.test(w.image)||!Number.isInteger(w.version)||w.version<1||!["pending","published","rejected"].includes(w.status)||typeof w.factsChecked!=="boolean"||!(w.scores===null||Array.isArray(w.scores)&&w.scores.length===4&&w.scores.every((n:number)=>Number.isInteger(n)&&n>=1&&n<=5))||!audit(w.audit))throw new Error("作品记录损坏");
 return s;
}
