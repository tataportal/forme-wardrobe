import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../worker/wardrobe-api.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', loader: { '.wasm': 'binary' }, logLevel: 'silent' });
const { handleWardrobeApi } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('save, update and copy preserve manual geometry; public previews expose silhouette bounds only', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const directory = new URL('../drizzle/', import.meta.url);
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) sqlite.exec(await readFile(new URL(name, directory), 'utf8'));
    const DB = { prepare(sql) {
      const statement = sqlite.prepare(sql); let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return statement.get(...values) ?? null; },
        async all() { return { results: statement.all(...values) }; },
        async run() { statement.run(...values); return { success: true }; },
      };
    }, async batch(statements) { for (const statement of statements) await statement.run(); } };
    const request = async (path, body) => {
      const response = await handleWardrobeApi(new Request(`http://localhost${path}`, body ? { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined), { DB }, { waitUntil() {} });
      assert.equal(response.status, 200, await response.clone().text()); return response.json();
    };
    const initial = (await request('/api/session')).user;
    await request('/api/profile', { ...initial, handle: '@preview-test', profilePublic: true, showLooks: true, showCloset: false });
    const owner = sqlite.prepare('SELECT id FROM users LIMIT 1').get().id;
    const bounds = [.15,.05,.7,.9];
    const measurement = { bounds, shoulderY:.12, hemY:.95, neckRise:.07, sleeveBottoms:[.8,.8], bodyHeight:.83, slots:5, region:'upper', bodyLength:'maxi', neckline:'collar', sleeveLength:'long', confidence:.99, measuredAt:'2026-09-08', source:'visual-qa+alpha' };
    const anatomy = JSON.stringify({ version:1, closed:{imageKey:'cutout-test',measurement}, open:null });
    sqlite.prepare("INSERT INTO garments(id,owner_id,client_id,name,category,color_family,tone,material,finish,silhouette,image_key,layout_json) VALUES ('server-coat',?,'uploaded-coat','Private name','Outerwear','black','dark','wool','matte','long','cutout-test',?)").run(owner,anatomy);
    const items = [{ instanceId:'piece-one',garmentId:'uploaded-coat',variant:'closed',x:-12.345,y:110.123,scale:1.113,rotation:23.125,z:8 }];
    for (const [id,name] of [['qa-look','Original'],['qa-look','Renamed'],['qa-copy','Copy']]) await request(`/api/outfits/${id}`, { name, items, isPublic:true });
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM outfits').get().n,2);
    for (const row of sqlite.prepare('SELECT x,y,scale,rotation,z FROM outfit_items').all()) assert.deepEqual({ ...row }, { x:-12345,y:110123,scale:1113,rotation:23125,z:8 });
    const profile = await request('/api/public-profile/preview-test');
    assert.deepEqual(profile.garments,[]);
    assert.equal(profile.outfits.length,2);
    for (const look of profile.outfits) {
      assert.equal(look.items.length,1);
      const item=look.items[0];
      assert.deepEqual(item.bounds,bounds);
      for (const key of ['x','y','scale','rotation','z']) assert.equal(item[key],items[0][key]);
      for (const key of ['layout_json','image_key','anatomy','name']) assert.equal(item[key],undefined);
    }
  } finally { sqlite.close(); }
});
