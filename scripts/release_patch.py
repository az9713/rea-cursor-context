from pathlib import Path
import json,hashlib,zipfile,shutil
p=Path(__file__).resolve().parents[1];c=json.loads((p/'electron-app.json').read_text());name=c['executable'];version=c['version'];out=p/'releases';folder=out/c.get('output_directory',name+'-win-x64')
assert folder.resolve().is_relative_to(out.resolve()) and (folder/'resources/app/main.cjs').is_file()
app=folder/'resources/app'
for rel in c['docs_files']:
 src=p/'docs'/rel;dest=app/'docs'/rel;assert src.resolve().is_relative_to((p/'docs').resolve()) and dest.resolve().is_relative_to(app.resolve());dest.parent.mkdir(exist_ok=True,parents=True);shutil.copyfile(src,dest)
for rel in ['README.md','LICENSE','NOTICE.md']:shutil.copyfile(p/rel,folder/rel)
assets=[]
def zip_files(target,pairs):
 with zipfile.ZipFile(out/target,'w',zipfile.ZIP_DEFLATED,compresslevel=6,strict_timestamps=False) as z:
  for file,rel in sorted(pairs,key=lambda x:x[1]):
   assert file.resolve().is_relative_to(p.resolve()) and not file.is_symlink();assert '.private.' not in rel and '/.git/' not in '/'+rel
   z.write(file,rel)
 with zipfile.ZipFile(out/target) as z:assert z.testzip() is None
 f=out/target;assets.append({'path':'releases/'+target,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
zip_files(name+'-'+version+'-win-x64.zip',[(f,(Path(name)/f.relative_to(folder)).as_posix()) for f in folder.rglob('*') if f.is_file()])
files=json.loads((p/'release-files.json').read_text())
zip_files('context-ledger-source-'+version+'.zip',[(p/rel,rel) for rel in files])
zip_files('context-ledger-hook-'+version+'.zip',[(p/rel,rel) for rel in ['README.md','LICENSE','NOTICE.md','src/hook.cjs','src/ledger.cjs','fixtures/hooks.example.json']])
zip_files('context-ledger-web-'+version+'.zip',[(f,f.relative_to(p/'docs').as_posix()) for f in (p/'docs').rglob('*') if f.is_file()])
archive=out/(name+'-'+version+'-win-x64.zip')
with zipfile.ZipFile(archive) as z:
 assert z.read(name+'/LICENSE.electron') and z.read(name+'/LICENSES.chromium.html')
 for rel in c['docs_files']:assert z.read(name+'/resources/app/docs/'+rel)==(p/'docs'/rel).read_bytes()
 assert z.read(name+'/resources/app/main.cjs')==(p/'scripts/electron-main.cjs').read_bytes()
(out/('SHA256SUMS-'+version+'.txt')).write_text(''.join(x['sha256']+'  '+Path(x['path']).name+'\n' for x in assets))
(out/('package-verification-'+version+'.json')).write_text(json.dumps({'passed':True,'source_files_match':True,'zip_crc':True,'runtime_notices':True,'renderer_matches_current':True,'assets':assets},indent=2))
print(json.dumps({'passed':True,'assets':assets}))
