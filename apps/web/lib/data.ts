import { createProject, type Project } from "./workflow";
export type Reference = {id:string;name:string;theme:string;image:string;author:string;url:string;description:string;dimension:string;colors:string[]};
export const references:Reference[]=[
 {id:"trail",name:"身体与山野的同频",theme:"动态",image:"/images/trail.jpg",author:"RUN 4 FFWPU",url:"https://www.pexels.com/photo/trail-runner-on-scenic-mountain-path-35599353/",description:"前景人物与远景空间形成层次，真实的运动姿态让画面具有现场感。",dimension:"人物 / 运动 / 叙事",colors:["#b94724","#645747","#a59a8a"]},
 {id:"architecture",name:"让光线成为结构",theme:"光影",image:"/images/architecture.jpg",author:"Mathias Reding",url:"https://www.pexels.com/photo/sunlight-and-shadow-on-building-12519360/",description:"硬光与几何阴影建立清晰秩序，可借鉴留白与局部聚焦的表达。",dimension:"光线 / 构图 / 几何",colors:["#d7c5af","#968672","#242420"]},
 {id:"sand",name:"触感，比语言更近",theme:"材质",image:"/images/sand.jpg",author:"Maria Varshavskaya",url:"https://www.pexels.com/photo/texture-of-sand-on-beach-in-sunlight-4931365/",description:"低饱和近景突出颗粒与浅景深。只借鉴视觉机制，不推断产品材料。",dimension:"质感 / 细节 / 景深",colors:["#c2c2bb","#797a73","#393c37"]}
];
export const directions=[
 {id:"motion",number:"01",name:"回到身体的节奏",en:"IN YOUR ELEMENT",ref:"trail",summary:"用真实运动和开阔环境，让产品自然进入故事。",strategy:"以人的行动为主线，从准备到出发，让产品成为场景的一部分。",light:"自然光 · 大地色 · 动态留白",risk:"需要谨慎处理人物、产品与背景的主次。",execution:"中等",originality:"熟悉场景，全新视角"},
 {id:"structure",number:"02",name:"让轻盈，被看见",en:"LESS, BUT CLOSER",ref:"architecture",summary:"减少画面噪音，用光影与结构聚焦一个表达。",strategy:"利用几何空间和明确的光线落点，把观看引向核心对象。",light:"硬光 · 几何构图 · 低饱和",risk:"不能因精简画面而省略必要的产品结构。",execution:"较低",originality:"跨领域的视觉转译"},
 {id:"texture",number:"03",name:"从细节感知自由",en:"FEEL THE DIFFERENCE",ref:"sand",summary:"靠近细节，让视觉节奏转向更安静的感知。",strategy:"以近景、材质观察与缓慢节奏建立感受，避免无依据的功能主张。",light:"漫射光 · 微距 · 单色层次",risk:"真实产品纹理未提供，不能直接替代为砂粒素材。",execution:"较低",originality:"感官优先的表达"}
];
export function seedProjects():Project[]{
 const p=createProject("demo-01","城市之外，重新出发","品牌影像","2026-09-21T01:00:00.000Z");
 return [
 {...p,brief:"为一个虚构的户外系列建立轻松、真实的创意方向。聚焦人与自然的关系，避免夸张性能描述。",audience:"喜欢周末户外活动的人",product:"户外随身装备（演示对象）",bound:true,confirmed:true,refs:["trail","architecture"],cover:"trail"},
 {...createProject("demo-02","轻装，自有节奏","产品叙事","2026-09-20T01:00:00.000Z"),brief:"从日常跑步场景出发，寻找克制、直接的产品表达。",cover:"architecture"},
 {...createProject("demo-03","日常也有旷野","编辑专题","2026-09-19T01:00:00.000Z"),brief:"用户外的观看方式，重新发现城市日常。",cover:"sand",archived:true}
 ];
}
