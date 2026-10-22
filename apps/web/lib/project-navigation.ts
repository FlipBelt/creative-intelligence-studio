import {canProduce,type Project,type Stage} from "./workflow.ts";

export type ProjectResume = {stage:Stage;href:string;label:string};

export function projectResume(project:Project):ProjectResume {
 const p=project.archived?{...project,archived:false}:project;
 let stage:Stage="production",label="继续创作";
 if(!p.simple&&!p.bound){stage="product";label="补充产品资料";}
 else if(!p.confirmed||!p.brief.trim()){stage="intent";label="完善需求";}
 else if(!p.simple&&!p.refs.length){stage="references";label="补充参考";}
 else if(!canProduce(p)){stage="directions";label=p.direction?"重新确认方向":"选择方向";}
 else if(p.assets.some(asset=>asset.revision===p.revision)){label="查看作品";}
 return {stage,href:"#/projects/"+p.id+"/"+stage,label:project.archived?"查看归档":label};
}

export function recentProjects(projects:Project[]):Project[] {
 const updated=(p:Project)=>{const stamp=Date.parse(p.updatedAt);return Number.isFinite(stamp)?stamp:-Infinity;};
 return projects.filter(p=>!p.archived).sort((a,b)=>{
  const first=updated(a),second=updated(b);
  return first===second?a.id.localeCompare(b.id):first>second?-1:1;
 }).slice(0,3);
}
