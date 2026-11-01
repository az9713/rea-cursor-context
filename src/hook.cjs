'use strict';
const L=require('./ledger.cjs');let input='',tooBig=false;
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{if(Buffer.byteLength(input)+Buffer.byteLength(chunk)>2_000_000){tooBig=true;input='';}else if(!tooBig)input+=chunk;});
process.stdin.on('end',()=>{let event;try{if(tooBig)throw Error('Hook input exceeds2MB');const p=JSON.parse(input);event=p.hook_event_name;L.append(p,process.cwd());process.stdout.write(JSON.stringify(L.response(event)));}catch(e){console.error('Context ledger recording failed: '+e.message);process.stdout.write(JSON.stringify(L.response(event)));process.exitCode=1;}});
