import {test} from "node:test";
import assert from "node:assert/strict";
import {createProject,updateInput,confirmDirection,canProduce,reviewAsset,finals,decodeProjects} from "./workflow.ts";
const now="2026-09-21T00:00:00Z";
function ready(){return updateInput(createProject("1","Example","Demo",now),{bound:true,product:"演示",brief:"示例需求",confirmed:true,refs:["trail"]},now);}
test("生产要求产品、需求和参考已确认",()=>{assert.throws(()=>confirmDirection(createProject("1","A","B",now),"motion",now));assert.equal(canProduce(ready()),false);assert.equal(canProduce(confirmDirection(ready(),"motion",now)),true);});
test("输入变化使方向失效，保留旧产物血缘",()=>{const p=confirmDirection(ready(),"motion",now);p.assets=[{id:"a",text:"演示",revision:p.revision,createdAt:now,status:"pending",note:""}];const q=updateInput(p,{brief:"变更"},now);assert.equal(canProduce(q),false);assert.equal(q.assets[0].revision,p.revision);assert.throws(()=>reviewAsset(q,"a","approved","",now));});
test("只有人工通过的产物进入Final，淘汰不进入",()=>{const p=confirmDirection(ready(),"motion",now);p.assets=[{id:"a",text:"演示",revision:p.revision,createdAt:now,status:"pending",note:""}];assert.equal(finals(p).length,0);assert.equal(finals(reviewAsset(p,"a","rejected","",now)).length,0);assert.equal(finals(reviewAsset(p,"a","approved","通过",now)).length,1);});
test("未知事实无默认填充，新项目为空",()=>{assert.equal(createProject("1","A","B",now).product,"");});
test("归档项目禁止生产与确认",()=>{const p={...ready(),archived:true};assert.equal(canProduce(p),false);assert.throws(()=>confirmDirection(p,"motion",now));});
test("损坏或未知版本本地数据拒绝读取",()=>{assert.throws(()=>decodeProjects('{"version":2,"projects":[]}'));assert.throws(()=>decodeProjects('{"version":1,"projects":[{}]}'));const p=ready();assert.deepEqual(decodeProjects(JSON.stringify({version:1,projects:[p]})),[p]);});
test("切换方向产生新输入版本，不能批准旧方向产物",()=>{const p=confirmDirection(ready(),"motion",now);p.assets=[{id:"a",text:"演示",revision:p.revision,createdAt:now,status:"pending",note:""}];const q=confirmDirection(p,"structure",now);assert.ok(q.revision>p.revision);assert.throws(()=>reviewAsset(q,"a","approved","",now));});

test("简易创作只需确认需求，缺失产品与参考保持未知",()=>{const p=updateInput(createProject("s","简单创作","社交内容",now),{simple:true,brief:"邀请大家周末出发",confirmed:true},now);const q=confirmDirection(p,"motion",now);assert.equal(canProduce(q),true);assert.equal(q.bound,false);assert.equal(q.product,"");assert.deepEqual(q.refs,[]);assert.equal(canProduce(updateInput(q,{brief:"改写需求"},now)),false);});
test("简易创作仍阻止空需求、归档和非法持久化标记",()=>{const p={...createProject("s","A","B",now),simple:true,confirmed:true};assert.throws(()=>confirmDirection(p,"motion",now));assert.throws(()=>confirmDirection({...p,brief:"需求",archived:true},"motion",now));assert.throws(()=>decodeProjects(JSON.stringify({version:1,projects:[{...p,simple:"yes"}]})));});
