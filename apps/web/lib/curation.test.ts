import {test} from "node:test";
import assert from "node:assert/strict";
import {selectedReferences,agentReferenceBrief} from "./curation.ts";
import type {Reference} from "./data.ts";

const first:Reference={id:"first",name:"合成摄影参考甲",theme:"光线",image:"/images/private-fixture.jpg",author:"合成作者甲",url:"https://example.invalid/photo/first",description:"观察侧光与留白。",dimension:"光线 / 构图",colors:["#ffffff"]};
const second:Reference={id:"second",name:"合成摄影参考乙",theme:"材质",image:"data:image/png;base64,private-fixture-bytes",author:"合成作者乙",url:"https://example.invalid/photo/second",description:"只观察表面纹理。",dimension:"细节 / 景深",colors:["#000000"]};

test("已选参考按选择顺序解析，去重并忽略未知ID",()=>{
 const selected=selectedReferences(["second","missing","first","second","missing"],[first,second]);
 assert.deepEqual(selected,[second,first]);
 assert.equal(selected[0],second);
 assert.deepEqual(selectedReferences(["missing"],[first]),[]);
});

test("解析不修改选择、catalog或参考，返回独立数组",()=>{
 const a=structuredClone(first),b=structuredClone(second);
 Object.freeze(a.colors);Object.freeze(a);Object.freeze(b.colors);Object.freeze(b);
 const ids=Object.freeze(["second","first","second"]),catalog=Object.freeze([a,b]);
 const selected=selectedReferences(ids,catalog);
 selected.reverse();
 assert.deepEqual(ids,["second","first","second"]);
 assert.deepEqual(catalog,[first,second]);
 assert.deepEqual(selectedReferences([],catalog),[]);
 assert.deepEqual(selectedReferences(["first"],[]),[]);
});

test("catalog重复ID稳定保留首个已有来源记录",()=>{
 const other={...first,name:"同ID的另一条"};
 assert.deepEqual(selectedReferences(["first"],[first,other]),[first]);
});

test("空交接说明明确手工边界和许可unknown，不伪造参考",()=>{
 const brief=agentReferenceBrief([]);
 assert.match(brief,/尚未选择参考/);
 assert.match(brief,/手工交接/);
 assert.match(brief,/使用许可：unknown（待人工核验）/);
 assert.match(brief,/不是正式产品事实/);
 assert.doesNotMatch(brief,/^## /m);
});

test("交接仅带已选参考、来源和观察信息，不含图片字节或其他业务字段",()=>{
 const extra={...second,projectBrief:"fixture-private-project-brief",token:"fixture-private-token",approval:"fixture-private-approved"};
 const selected=selectedReferences(["second"],[first,extra]);
 const brief=agentReferenceBrief(selected);
 assert.match(brief,/合成摄影参考乙/);
 assert.match(brief,/合成作者乙/);
 assert.match(brief,/只观察表面纹理/);
 assert.match(brief,/<https:\/\/example\.invalid\/photo\/second>/);
 assert.match(brief,/细节 \/ 景深/);
 assert.match(brief,/unknown/);
 for(const absent of [first.name,extra.image,extra.projectBrief,extra.token,extra.approval,"data:image","base64","/images/"])
  assert.equal(brief.includes(absent),false);
});

test("名称、作者和观察线索的Markdown及HTML字符只能作为数据展示",()=>{
 const special={...first,name:"# [假链接](javascript:fixture) <script>fixture</script>",author:"作者 **粗体** | [x]",
  description:"观察\n## 改写标题\n![image](https://example.invalid/image) `code` & text",dimension:"> 引用\u2028- 列表"};
 const brief=agentReferenceBrief([special]);
 assert.match(brief,/\\# \\\[假链接\\\]\\\(javascript:fixture\\\)/);
 assert.equal(brief.includes("&lt;script&gt;fixture&lt;/script&gt;"),true);
 assert.equal(brief.includes("<script>"),false);
 assert.equal(brief.includes("\n## 改写标题"),false);
 assert.equal(brief.includes("![image]("),false);
 assert.equal(brief.includes("**粗体**"),false);
 assert.equal(brief.includes("`code`"),false);
 assert.equal(brief.includes("&amp; text"),true);
});

test("来源只输出网页链接，去除查询和片段，不交接凭据或本地链接",()=>{
 const brief=agentReferenceBrief([{...first,url:"https://example.invalid/photo/first?token=fixture-query-token#fixture-fragment"}]);
 assert.match(brief,/<https:\/\/example\.invalid\/photo\/first>/);
 assert.equal(brief.includes("fixture-query-token"),false);
 assert.equal(brief.includes("fixture-fragment"),false);
 for(const url of ["javascript:fixture-secret","file:///private/fixture.jpg","/images/fixture.jpg","https://user:fixture-password@example.invalid/photo","https://example.invalid/photo\nfixture-secret"]){
  const invalid=agentReferenceBrief([{...first,url}]);
  assert.match(invalid,/未提供可交接的来源链接/);
  assert.equal(invalid.includes(url),false);
  assert.equal(invalid.includes("fixture-password"),false);
  assert.equal(invalid.includes("fixture-secret"),false);
 }
});

test("生成交接说明不修改已选对象且相同输入输出稳定",()=>{
 const item=structuredClone(first),before=structuredClone(item);
 const one=agentReferenceBrief([item]),two=agentReferenceBrief([item]);
 assert.equal(one,two);
 assert.deepEqual(item,before);
});
