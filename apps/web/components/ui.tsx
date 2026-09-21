"use client";
import { useEffect,useId,useRef,useState,type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, X, Plus, Check, ImageOff } from "lucide-react";
import {type Reference} from "../lib/data";
export function Button({children,onClick,primary=false,disabled=false,type="button"}:{children:ReactNode;onClick?:()=>void;primary?:boolean;disabled?:boolean;type?:"button"|"submit"}){return <button className={"button "+(primary?"primary":"")} type={type} onClick={onClick} disabled={disabled}>{children}</button>;}
export function Heading({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){return <><div className="eyebrow">{eyebrow}</div><div className="page-heading compact"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div></>;}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}){return <div className="empty"><span className="empty-mark"><Plus size={28}/></span><h2>{title}</h2><p>{description}</p>{children}</div>;}
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{const previous=document.activeElement;const d=ref.current;d?.showModal();return()=>{d?.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
 return <dialog ref={ref} className={wide?"modal wide":"modal"} aria-labelledby={id} onCancel={onClose}><div className="modal-top"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18}/></button></div>{children}</dialog>;
}
export function Photo({src,alt,className=""}:{src:string;alt:string;className?:string}){const[failed,setFailed]=useState(false);return failed?<div className={"photo-failed "+className}><ImageOff/><span>图片暂不可用</span></div>:<img className={className} src={src} alt={alt} onError={()=>setFailed(true)} loading="lazy"/>;}
export function ReferenceCard({r,selected=false,onToggle,onOpen}:{r:Reference;selected?:boolean;onToggle?:()=>void;onOpen:()=>void}){
 return <article className={"reference-card "+(selected?"is-selected":"")}><button className="reference-photo" onClick={onOpen} aria-label={"查看参考："+r.name}><Photo src={r.image} alt={r.name}/><span className="image-label">{r.theme} / PHOTOGRAPHY</span><span className="photo-open"><ArrowUpRight size={20}/></span></button><div className="reference-copy"><span className="small-label">摄影参考 · Pexels</span><h3><button onClick={onOpen}>{r.name}</button></h3><p>{r.dimension}</p><div className="reference-footer"><div className="swatches" aria-label="参考色彩">{r.colors.map(c=><span key={c} style={{background:c}}/>)}</div>{onToggle&&<button aria-pressed={selected} className={"select-reference "+(selected?"checked":"")} onClick={onToggle}>{selected?<Check size={15}/>:<Plus size={15}/>} {selected?"已加入":"加入组合"}</button>}</div></div></article>;
}
export function StepLink({href,children}:{href:string;children:ReactNode}){return <a href={href} className="text-link">{children}<ArrowRight size={16}/></a>;}
