import {test} from "node:test";
import assert from "node:assert/strict";
import {createProject,confirmDirection,updateInput,type Project} from "./workflow.ts";
import {projectResume,recentProjects} from "./project-navigation.ts";

const now="2026-10-22T00:00:00Z";
function ready():Project{return confirmDirection({...createProject("local-1","本地项目","活动文案",now),simple:true,brief:"邀请大家周末出发",confirmed:true},"direct",now);}
function output(p:Project,revision=p.revision):Project{return {...p,assets:[{id:"asset-1",text:"文案",revision,createdAt:now,status:"pending",note:""}]};}

test("空需求或未确认需求返回填写入口，即使存在旧方向或产物",()=>{
 const p=output(ready());
 for(const patch of [{brief:"  "},{confirmed:false}])assert.equal(projectResume({...p,...patch}).stage,"intent");
 assert.equal(projectResume({...p,confirmed:false}).label,"完善需求");
});
test("旧项目先补产品与参考，简易项目保留可选资料",()=>{
 const p={...ready(),simple:false,bound:false,refs:[]};
 assert.equal(projectResume(p).stage,"product");
 assert.equal(projectResume({...p,bound:true}).stage,"references");
 assert.equal(projectResume(ready()).stage,"production");
});
test("已保存需求先选方向，确认后的方向继续创作",()=>{
 const p=ready();
 assert.deepEqual(projectResume({...p,direction:"",instructionRevision:null}),{stage:"directions",href:"#/projects/local-1/directions",label:"选择方向"});
 assert.deepEqual(projectResume(p),{stage:"production",href:"#/projects/local-1/production",label:"继续创作"});
});
test("只有当前输入版本的产物显示查看作品",()=>{
 const p=ready();
 assert.equal(projectResume(output(p)).label,"查看作品");
 assert.equal(projectResume(output(p,p.revision-1)).label,"继续创作");
});
test("输入过期优先重新确认方向，历史已通过产物不能让导航跳过确认",()=>{
 const p=output(ready());p.assets[0].status="approved";
 const changed=updateInput(p,{brief:"新的活动要求"},now);
 assert.equal(projectResume(changed).stage,"directions");
 assert.equal(projectResume(changed).label,"重新确认方向");
 assert.equal(projectResume({...changed,confirmed:false}).stage,"intent");
});
test("归档项目仍可查看已有阶段，但不会推荐继续创作",()=>{
 const p={...output(ready()),archived:true};
 assert.deepEqual(projectResume(p),{stage:"production",href:"#/projects/local-1/production",label:"查看归档"});
 assert.deepEqual(recentProjects([p]),[]);
});
test("最近项目排除归档、按真实更新时间取三项，且不修改原数组",()=>{
 const base=ready();
 const projects=[
  {...base,id:"demo-older",updatedAt:"2026-10-20T00:00:00Z"},
  {...base,id:"local-b",updatedAt:"2026-10-22T00:00:00Z"},
  {...base,id:"archived",archived:true,updatedAt:"2026-10-23T00:00:00Z"},
  {...base,id:"local-a",updatedAt:"2026-10-21T23:00:00-01:00"},
  {...base,id:"local-third",updatedAt:"2026-10-21T00:00:00Z"},
  {...base,id:"invalid-date",updatedAt:"unknown"}
 ];
 const before=JSON.stringify(projects);
 assert.deepEqual(recentProjects(projects).map(p=>p.id),["local-a","local-b","local-third"]);
 assert.equal(JSON.stringify(projects),before);
 assert.deepEqual(recentProjects([]),[]);
});
