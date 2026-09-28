import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const bundle = await build({ entryPoints:[fileURLToPath(new URL('../worker/wardrobe-api.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',loader:{'.wasm':'binary'},logLevel:'silent' });
const { handleWardrobeApi } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('manual sizes persist per account and platform without modifying saved looks', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const dir = new URL('../drizzle/',import.meta.url);
    for (const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) sqlite.exec(await readFile(new URL(name,dir),'utf8'));
    const DB = { prepare(sql) { const stmt=sqlite.prepare(sql);let values=[];return {
      bind(...args){values=args;return this;}, async first(){return stmt.get(...values)??null;},
      async all(){return {results:stmt.all(...values)};}, async run(){stmt.run(...values);return {success:true};},
    }; } };
    const api = async (email,path,body) => {
      const response=await handleWardrobeApi(new Request(`http://localhost${path}`,{method:body?'PUT':'GET',headers:{'oai-authenticated-user-email':email,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB},{waitUntil(){}});
      return {status:response.status,body:await response.json()};
    };
    const a=(await api('a@test.local','/api/session')).body.user;
    await api('b@test.local','/api/session');
    const path='/api/garments/archive-002/canvas-size';
    assert.equal((await api('a@test.local',path,{scaleMultiplier:1.2,platform:'desktop'})).status,200);
    assert.equal((await api('a@test.local','/api/wardrobe')).body.canvasSizes.desktop['archive-002'],1.2);
    assert.equal((await api('a@test.local','/api/wardrobe')).body.canvasSizes.mobile['archive-002'],undefined);
    assert.deepEqual((await api('b@test.local','/api/wardrobe')).body.canvasSizes,{mobile:{},desktop:{}});
    await api('a@test.local',path,{scaleMultiplier:.9,platform:'mobile'});
    const sizes=(await api('a@test.local','/api/wardrobe')).body.canvasSizes;
    assert.equal(sizes.desktop['archive-002'],1.2);
    assert.equal(sizes.mobile['archive-002'],.9);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM garment_canvas_preferences').get().n,1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM outfits').get().n,0);
    for(const value of [0,-1,21,null,'1.2']) assert.equal((await api('a@test.local',path,{scaleMultiplier:value,platform:'mobile'})).status,400);
    assert.equal((await api('a@test.local',path,{scaleMultiplier:1.2,platform:'tablet'})).status,400);
    sqlite.prepare("INSERT INTO garments (id,owner_id,client_id,name,category,color_family,tone,material,finish,silhouette) VALUES ('private-row',?,'private-piece','Top','Tops','white','light','cotton','matte','regular')").run(a.id);
    assert.equal((await api('a@test.local','/api/garments/private-piece/canvas-size',{scaleMultiplier:1.1,platform:'desktop'})).status,200);
    assert.equal((await api('b@test.local','/api/garments/private-piece/canvas-size',{scaleMultiplier:1.8,platform:'desktop'})).status,404);
    assert.equal((await api('b@test.local','/api/wardrobe')).body.canvasSizes.desktop['private-piece'],undefined);
  } finally {sqlite.close();}
});
