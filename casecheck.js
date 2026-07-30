const fs=require('fs');
const path=require('path');
const root=process.cwd();
const files=[];
function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const full=path.join(dir,name);
    const stat=fs.statSync(full);
    if(stat.isDirectory()) walk(full);
    else if(full.endsWith('.ts')||full.endsWith('.tsx')||full.endsWith('.js')||full.endsWith('.jsx')) files.push(full);
  }
}
walk(path.join(root,'src'));
const actualPaths=new Set(files.map(f=>f.replace(/\\/g,'/')));
function findCaseMismatch(importPath, fromFile){
  if(!importPath.startsWith('.')&&!importPath.startsWith('/')) return null;
  const resolved=path.resolve(path.dirname(fromFile), importPath);
  const variants=['.ts','.tsx','.js','.jsx','/index.ts','/index.tsx','/index.js','/index.jsx'];
  for(const ext of variants){
    const candidate=resolved.endsWith(ext)?resolved:resolved+ext;
    const normalized=candidate.replace(/\\/g,'/');
    if(actualPaths.has(normalized)){
      const real=fs.realpathSync.native(normalized);
      if(real.replace(/\\/g,'/')!==normalized) return {importPath, fromFile, expected: normalized, actual: real.replace(/\\/g,'/')};
      return null;
    }
  }
  return null;
}
const mismatches=[];
const importRegex=/import\s+(?:[^'\";]*from\s*)?[\"']([^\"']+)[\"']/g;
for(const file of files){
  const content=fs.readFileSync(file,'utf8');
  let m;
  while((m=importRegex.exec(content))){
    const imp=m[1];
    const mismatch=findCaseMismatch(imp,file);
    if(mismatch) mismatches.push(mismatch);
  }
}
if(mismatches.length) console.log(JSON.stringify(mismatches,null,2)); else console.log('NO_CASE_MISMATCH');
