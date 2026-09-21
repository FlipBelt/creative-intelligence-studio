"use client";
import {useEffect,useState} from "react";
import {decodeStudio,emptyStudio,type Studio} from "./studio";
const KEY="cis-studio-library-v1";
export function useStudio(){
 const[data,setData]=useState<Studio>(emptyStudio),[ready,setReady]=useState(false),[error,setError]=useState(""),[blocked,setBlocked]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw)setData(decodeStudio(raw));}catch{setBlocked(true);setError("本地资料读取失败，原数据未覆盖。请使用其他浏览器继续演示。");}setReady(true);},[]);
 function save(next:Studio):boolean{if(!ready||blocked){setError("本地资料不可写入");return false;}try{localStorage.setItem(KEY,JSON.stringify(next));setData(next);setError("");return true;}catch{setError("本地空间不足或保存被阻止，操作未保存。请缩小图片后重试。");return false;}}
 return {data,save,ready,error};
}
