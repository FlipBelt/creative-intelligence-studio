import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const plugin=join(root,'plugins/cis-materials');
const json=path=>JSON.parse(readFileSync(path,'utf8'));

test('local catalog and compatibility manifest resolve only the intended readonly plugin',()=>{
 const market=json(join(root,'.agents/plugins/marketplace.json'));
 assert.equal(market.name,'cis-local');assert.equal(market.plugins.length,1);
 const entry=market.plugins[0];assert.equal(entry.name,'cis-materials');
 assert.deepEqual(entry.source,{source:'local',path:'./plugins/cis-materials'});
 assert.equal(entry.policy.installation,'AVAILABLE');
 const manifest=json(join(plugin,'.codex-plugin/plugin.json'));
 assert.equal(manifest.name,entry.name);assert.equal(manifest.mcpServers,'./.mcp.json');
 assert.equal(manifest.skills,'./skills/');assert.deepEqual(manifest.interface.capabilities,['Read']);
 assert.equal(manifest.hooks,undefined);assert.equal(manifest.apps,undefined);
 const servers=json(join(plugin,'.mcp.json')).mcpServers;assert.deepEqual(Object.keys(servers),['materials']);
 assert.deepEqual(servers.materials,{command:'node',args:['server.mjs'],cwd:'./'});
 // Codex 0.150.1 compatibility MCP loader resolves cwd relative to the plugin root; no macros.
 const launchCwd=resolve(plugin,servers.materials.cwd);
 assert.equal(launchCwd,plugin);readFileSync(resolve(launchCwd,servers.materials.args[0]));
 assert.equal(JSON.stringify(servers).includes('${PLUGIN_ROOT}'),false);
});

test('distributed runtime imports are builtins or stay inside the plugin, with no external dependency',()=>{
 let count=0;
 const walk=dir=>{for(const item of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,item.name);
  if(item.isDirectory())walk(path);
  else if(item.name.endsWith('.mjs')){
   count++;const source=readFileSync(path,'utf8');
   for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
    const name=match[1];if(name.startsWith('node:'))continue;
    assert.ok(name.startsWith('./')||name.startsWith('../'),'external runtime dependency: '+name);
    const target=resolve(dirname(path),name),rel=relative(plugin,target);
    assert.ok(!rel.startsWith('..')&&!rel.includes(':'));readFileSync(target);
   }
  }
 }};walk(plugin);assert.ok(count>=4);
});

test('a plugin copy outside the repo can initialize and list only four readonly tools', {timeout:15000},async t=>{
 const temp=mkdtempSync(join(tmpdir(),'cis-plugin-package-'));
 t.after(()=>rmSync(temp,{recursive:true,force:true}));cpSync(plugin,join(temp,'plugin'),{recursive:true});
 const client=new Client({name:'cis-package-regression',version:'0.1.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[join(temp,'plugin/server.mjs')],cwd:temp,stderr:'pipe'});
 try{
  await client.connect(transport);
  const result=await client.listTools();
  assert.deepEqual(result.tools.map(x=>x.name).sort(),['get_collection','list_collections','read_material','search_materials']);
  for(const tool of result.tools){assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.destructiveHint,false);assert.equal(tool.inputSchema.additionalProperties,false);}
  let blocked;
  try {
   blocked=await client.callTool({name:'delete_material',arguments:{path:'SYNTHETIC_PRIVATE_SENTINEL'}});
   assert.equal(blocked.isError,true);
  } catch(error) {
   assert.ok([-32601,-32602].includes(error.code));
   blocked={code:error.code,message:error.message};
  }
  assert.equal(JSON.stringify(blocked).includes('SYNTHETIC_PRIVATE_SENTINEL'),false);
 }finally{await client.close();await transport.close();}
});

test('delegated source processes cannot recursively launch the materials plugin',{timeout:5000},async()=>{
 const result=await new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,[join(plugin,'server.mjs')],{env:{...process.env,CIS_MATERIALS_PROXY_CHILD:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='';child.stdout.on('data',data=>stdout+=data);
  child.on('error',reject);child.on('exit',code=>resolveResult({code,stdout}));
 });
 assert.equal(result.code,1);assert.equal(result.stdout,'');
});
