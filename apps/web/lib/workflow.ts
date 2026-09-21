export type Asset = { id: string; text: string; revision: number; createdAt: string; status: "pending" | "approved" | "rejected"; note: string };
export type Project = { id: string; name: string; category: string; brief: string; audience: string; output: string; product: string; bound: boolean; confirmed: boolean; refs: string[]; direction: string; instructionRevision: number | null; revision: number; archived: boolean; assets: Asset[]; cover: string; updatedAt: string };
export const stages = [
 ["product","产品理解"],["intent","创意需求"],["references","参考发现"],["reference-set","参考组合"],["analysis","创意分析"],["directions","创意方向"],["board","创意板"],["production","生产工作室"],["review","评审"],["finals","最终资产"]
] as const;
export type Stage = typeof stages[number][0];
export function createProject(id: string, name: string, category: string, now: string): Project {
 return {id,name,category,brief:"",audience:"",output:"文案",product:"",bound:false,confirmed:false,refs:[],direction:"",instructionRevision:null,revision:1,archived:false,assets:[],cover:"",updatedAt:now};
}
export function updateInput(p: Project, patch: Partial<Pick<Project,"brief"|"audience"|"output"|"product"|"bound"|"confirmed"|"refs">>, now: string): Project {
 return {...p,...patch,revision:p.revision+1,instructionRevision:null,updatedAt:now};
}
export function directionGate(p: Project): string | null {
 if (p.archived) return "请先恢复已归档项目";
 if (!p.bound) return "先在产品理解中保存当前项目输入";
 if (!p.confirmed || !p.brief.trim()) return "先保存并确认创意需求";
 if (!p.refs.length) return "至少选择一项摄影参考";
 return null;
}
export function confirmDirection(p: Project, direction: string, now: string): Project {
 const reason=directionGate(p); if(reason) throw new Error(reason);
 const revision=p.direction!==direction?p.revision+1:p.revision; return {...p,direction,revision,instructionRevision:revision,updatedAt:now};
}
export function canProduce(p: Project): boolean { return !p.archived && !!p.direction && p.instructionRevision===p.revision && !directionGate(p); }
export function reviewAsset(p: Project,id:string,status:Asset["status"],note:string,now:string): Project {
 const a=p.assets.find(a=>a.id===id);
 if(!a) throw new Error("找不到产物");
 if(p.archived) throw new Error("请先恢复已归档项目");
 if(status==="approved" && (!canProduce(p)||a.revision!==p.revision)) throw new Error("输入已更新，请重新确认方向并制作新版本");
 return {...p,updatedAt:now,assets:p.assets.map(a=>a.id===id?{...a,status,note}:a)};
}
export function finals(p:Project): Asset[] { return p.assets.filter(a=>a.status==="approved"); }
export function projectStage(p:Project): Stage { if(finals(p).length)return "finals";if(p.assets.length)return "review";if(p.direction)return "directions";if(p.refs.length)return "reference-set";if(p.confirmed)return "references";if(p.bound)return "intent";return "product"; }
export function decodeProjects(raw:string):Project[] {
 const data:unknown=JSON.parse(raw);
 if(!data||typeof data!=="object"||!("version"in data)||data.version!==1||!("projects"in data)||!Array.isArray(data.projects))throw new Error("本地数据版本不受支持");
 const strings=["id","name","category","brief","audience","output","product","direction","cover","updatedAt"] as const;
 for(const p of data.projects){
  if(!p||typeof p!=="object"||strings.some(k=>typeof p[k]!=="string")||!["bound","confirmed","archived"].every(k=>typeof p[k]==="boolean")||!Number.isInteger(p.revision)||p.revision<1||!(p.instructionRevision===null||Number.isInteger(p.instructionRevision))||!Array.isArray(p.refs)||!p.refs.every((s:unknown)=>typeof s==="string")||!Array.isArray(p.assets))throw new Error("本地项目数据无法读取");
  for(const a of p.assets)if(!a||!["id","text","createdAt","note"].every(k=>typeof a[k]==="string")||!Number.isInteger(a.revision)||!["pending","approved","rejected"].includes(a.status))throw new Error("本地产物数据无法读取");
 }
 return data.projects as Project[];
}
