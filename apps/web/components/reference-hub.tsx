"use client";
import {useState} from "react";
import {ArrowRight,Copy,ExternalLink,X} from "lucide-react";
import {references,type Reference} from "../lib/data";
import {agentReferenceBrief,selectedReferences} from "../lib/curation";
import {type Studio} from "../lib/studio";
import {ReferenceGallery} from "./home-studio";
import {Button,Empty,Heading,Photo} from "./ui";

type GalleryActions={data:Studio;save:(next:Studio)=>boolean;onOpen:(reference:Reference)=>void;onUse:(reference:Reference)=>void;referenceIds:readonly string[]};

export function ReferenceHub({data,save,onOpen,onUse,referenceIds}:GalleryActions){
 const count=selectedReferences(referenceIds,references).length;
 return <>
  <Heading eyebrow="CURATED REFERENCES" title="精选素材" description="寻找视觉参考，整理一份带来源的素材清单，再交给你使用的 Agent。" action={<a className="button primary" href="#/collection">素材清单 · {count}<ArrowRight size={17}/></a>}/>
  <p className="hub-scope">当前提供 {references.length} 项已注明来源的摄影参考，用于观察构图、光线和视觉语言。真实产品素材与团队素材网关尚未接入。</p>
  <ReferenceGallery home title="摄影参考" actionLabel="加入清单" selectedIds={referenceIds} data={data} save={save} onOpen={onOpen} onUse={onUse}/>
  <section className="hub-next" aria-label="素材与工具入口">
   <div><h2>在 Agent 中继续</h2><p>复制素材清单与来源，在已获授权的 Agent 客户端中使用。本站暂不直接执行创作任务。</p><a className="text-link" href="#/agent">查看接入方式<ArrowRight size={16}/></a></div>
   <div><h2>查看本地作品</h2><p>已提交的图片和审核记录仍保存在当前浏览器，未与团队 DAM 同步。</p><a className="text-link" href="#/assets">打开本地作品库<ArrowRight size={16}/></a></div>
  </section>
 </>;
}

export function ReferenceCollection({referenceIds,onRemove,onOpen}:{referenceIds:readonly string[];onRemove:(id:string)=>void;onOpen:(reference:Reference)=>void}){
 const items=selectedReferences(referenceIds,references),content=agentReferenceBrief(items);
 const[copying,setCopying]=useState(false),[copyResult,setCopyResult]=useState<{content:string;failed:boolean}|null>(null);
 const feedback=copyResult?.content===content?copyResult:null;
 async function copy(){
  if(!items.length||copying)return;
  setCopying(true);setCopyResult(null);
  try{
   if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
   await navigator.clipboard.writeText(content);
   setCopyResult({content,failed:false});
  }catch{setCopyResult({content,failed:true});}
  finally{setCopying(false);}
 }
 return <>
  <Heading eyebrow="REFERENCE COLLECTION" title="素材清单" description="当前标签页选择的摄影参考。来源和使用边界会一起带给 Agent，选择不等于获得素材使用许可。" action={<Button primary disabled={!items.length||copying} onClick={()=>void copy()}><Copy size={17}/>{copying?"正在复制…":"复制给 Agent"}</Button>}/>
  <p className="caption">清单与旧版工作台共享参考选择；移除只影响本次清单，不删除素材或收藏。</p>
  {feedback&&<div className={"notice "+(feedback.failed?"error":"")} role={feedback.failed?"alert":"status"}>{feedback.failed?"自动复制未完成。请从下方手工复制清单，再粘贴到你使用的 Agent。":"清单已复制。请在已获授权的 Agent 中粘贴，使用前核对来源和素材许可。"}</div>}
  {items.length?<div className="collection-list">{items.map(reference=><article className="collection-row" key={reference.id}>
   <button className="collection-image" onClick={()=>onOpen(reference)} aria-label={"查看参考："+reference.name}><Photo src={reference.image} alt={reference.name}/></button>
   <div><h2><button onClick={()=>onOpen(reference)}>{reference.name}</button></h2><p>{reference.author} · 摄影参考</p><p>{reference.dimension}</p><a className="text-link" href={reference.url} target="_blank" rel="noreferrer">原始来源<ExternalLink size={15}/></a></div>
   <button className="button collection-remove" aria-label={"从清单移除："+reference.name} onClick={()=>onRemove(reference.id)}><X size={16}/>移除</button>
  </article>)}</div>:<Empty title="清单里还没有素材" description="从精选素材中查看来源，再把适合的摄影参考加入清单。"><a className="button primary" href="#/projects">浏览精选素材<ArrowRight size={17}/></a></Empty>}
  {feedback?.failed&&items.length>0&&<label className="field manual-copy">供手工复制的素材清单<textarea readOnly rows={14} value={content} onFocus={event=>event.currentTarget.select()}/></label>}
  <div className="collection-footer"><a className="text-link" href="#/projects">继续挑选素材<ArrowRight size={16}/></a><a className="text-link" href="#/agent">查看 Agent 接入说明<ArrowRight size={16}/></a></div>
 </>;
}

export function AgentAccess(){
 return <>
  <Heading eyebrow="AGENT TOOLS" title="Agent 接入" description="在这里发现和整理素材，在你已获授权的 Agent 客户端中完成后续任务。"/>
  <section className="settings-list agent-access" aria-label="当前接入状态">
   <div className="setting-row"><div><h2>手工传递素材清单</h2><p>可复制包含来源和使用边界的 Markdown 清单；复制失败时支持手工复制。不会自动把数据发送给第三方。</p><a className="text-link" href="#/collection">打开素材清单<ArrowRight size={16}/></a></div><span className="badge">可用</span></div>
   <div className="setting-row"><div><h2>Agent 插件</h2><p>当前尚未提供可安装插件，真实客户端接入与安装验收仍待完成。</p></div><span className="badge">未交付 · 未安装验收</span></div>
   <div className="setting-row"><div><h2>真实素材网关</h2><p>本站尚未连接团队 DAM 或正式产品知识服务，不能从页面查询真实素材或登记成果。</p></div><span className="badge">未接入</span></div>
  </section>
  <section className="agent-guide"><h2>目前怎样使用</h2><ol><li>在精选素材中查看原始来源，选择适合的摄影参考。</li><li>打开素材清单，复制包含来源与使用边界的内容。</li><li>在你已获授权的 Agent 中粘贴，并在实际使用前核对平台限制和素材许可。</li></ol><p className="caption">复制清单不执行生成、上传或素材登记；本站不收集 Agent 密钥。</p></section>
  <details className="advanced-options"><summary>高级诊断</summary><p>工程中的 Reference MCP 目前仅为合成测试夹具，不连接真实数据源，不执行付费采集，也不是本站已安装的 Agent 插件。</p><p>旧版工作台与技能资料仍可查看；技能在页面中仅保存内容与版本，不执行上传文件。</p></details>
 </>;
}
