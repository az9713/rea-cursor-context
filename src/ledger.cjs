'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const EVENTS=new Set(['beforeSubmitPrompt','beforeReadFile','afterFileEdit','preCompact','stop']);
function canonical(v,depth=0){if(depth>30)throw Error('Data too deeply nested');if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(x=>canonical(x,depth+1)).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k],depth+1)).join(',')+'}';throw Error('Unsupported canonical value');}
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
function normalize(payload,workspace){
 if(!payload||typeof payload!=='object'||!EVENTS.has(payload.hook_event_name))throw Error('Unsupported hook event');
 for(const k of ['conversation_id','generation_id'])if(typeof payload[k]!=='string'||!payload[k]||payload[k].length>1000)throw Error('Missing session or generation identity');
 const e={event:payload.hook_event_name,conversation:hash(payload.conversation_id),generation:hash(payload.generation_id),observed_at:new Date().toISOString(),scope:'hook-reported; final model context unknown'};
 if(typeof payload.file_path==='string'){
  const rel=path.relative(path.resolve(workspace),path.resolve(workspace,payload.file_path));e.file=rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)?rel.split(path.sep).join('/'):'[outside-workspace]';
 }
 if(typeof payload.content==='string')e.content_sha256=hash(payload.content);
 if(typeof payload.prompt==='string')e.prompt_sha256=hash(payload.prompt);
 if(Array.isArray(payload.edits))e.edits_sha256=hash(payload.edits);
 if(Array.isArray(payload.attachments))e.attachment_count=payload.attachments.length;
 if(e.event==='preCompact'){
  e.metrics={};for(const k of ['context_usage_percent','token_count','context_window_size'])if(typeof payload[k]==='number'&&Number.isFinite(payload[k]))e.metrics[k]=payload[k];
  e.post_compaction_semantics='unobserved';
 }
 return e;
}
function verify(records){
 if(!Array.isArray(records)||records.length>50000)throw Error('Invalid ledger length');let prev=null;
 for(let i=0;i<records.length;i++){
  const r=records[i];if(!r||r.schema!=='context-ledger/v1'||r.sequence!==i+1||r.previous!==prev||!r.data||!EVENTS.has(r.data.event)||typeof r.digest!=='string')throw Error('Ledger structure/sequence broken at '+(i+1));
  for(const key of ['conversation','generation'])if(typeof r.data[key]!=='string'||!/[a-f0-9]{64}/.test(r.data[key])||r.data[key].length!==64)throw Error('Invalid turn identity');
  if(typeof r.data.observed_at!=='string'||!Number.isFinite(Date.parse(r.data.observed_at))||r.data.scope!=='hook-reported; final model context unknown')throw Error('Invalid observation scope');
  const expected=hash({schema:r.schema,sequence:r.sequence,previous:r.previous,data:r.data});if(expected!==r.digest)throw Error('Ledger digest broken at '+(i+1));prev=r.digest;
 }
 return {records:records.length,head:prev,scope:'Internal consistency only. A rewritten whole ledger requires an external head anchor to detect.'};
}
function parse(text){if(typeof text!=='string'||Buffer.byteLength(text)>20_000_000)throw Error('Ledger input exceeds20MB');const records=text.split(/\r?\n/).filter(s=>s.trim()).map(s=>JSON.parse(s));verify(records);return records;}
function append(payload,workspace){
 const root=fs.realpathSync(workspace),dir=path.join(root,'.context-ledger');
 if(fs.existsSync(dir)&&fs.lstatSync(dir).isSymbolicLink())throw Error('Ledger directory must not be a link');
 fs.mkdirSync(dir,{recursive:true});if(fs.realpathSync(dir)!==dir)throw Error('Ledger directory must resolve inside workspace');
 const lock=path.join(dir,'write.lock'),file=path.join(dir,'events.jsonl');let acquired=false;
 for(let i=0;i<100;i++){try{fs.mkdirSync(lock);acquired=true;break;}catch(e){if(e.code!=='EEXIST')throw e;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);}}
 if(!acquired)throw Error('Ledger busy or abandoned lock; no record written');
 try{
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('Ledger file must not be a link');
  if(fs.existsSync(file)&&fs.statSync(file).size>20_000_000)throw Error('Ledger full; archive it before continuing');
  const records=fs.existsSync(file)?parse(fs.readFileSync(file,'utf8')):[];
  const data=normalize(payload,root),body={schema:'context-ledger/v1',sequence:records.length+1,previous:records.length?records.at(-1).digest:null,data},record={...body,digest:hash(body)};
  if(records.length>=50000)throw Error('Ledger record limit reached');
  fs.appendFileSync(file,canonical(record)+'\n',{encoding:'utf8',mode:0o600});return record;
 }finally{fs.rmdirSync(lock);}
}
function response(event){return event==='beforeReadFile'?{permission:'allow'}:event==='beforeSubmitPrompt'?{continue:true}:{};}
module.exports={canonical,hash,normalize,verify,parse,append,response};
