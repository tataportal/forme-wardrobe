import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { bundleModule, consentRequest, cookieFrom, completeLogin, env, version } from './helpers/legal-fixture.mjs';
const {handleGoogleAuth, readNativeSession} = await bundleModule('../../worker/google-auth.ts');
const {handleWardrobeApi} = await bundleModule('../../worker/wardrobe-api.ts');

test('direct login links display the legal form; incomplete, stale and cross-origin consent never starts OAuth', async () => {
  const direct = await handleGoogleAuth(new Request('https://forme.gallery/auth/google/start?return_to=%2Fcanvas'),env);
  assert.equal(direct.headers.get('location'),'/ingresar?return_to=%2Fcanvas');
  assert.equal(direct.headers.get('set-cookie'),null);
  for (const values of [{terms:''},{privacy:''},{version:'old'}]) {
    const response = await handleGoogleAuth(consentRequest(values),env);
    assert.match(response.headers.get('location'),/^\/ingresar\?error=consent/);
    assert.equal(response.headers.get('set-cookie'),null);
  }
  const cross = consentRequest(); cross.headers.set('origin','https://evil.test');
  assert.equal((await handleGoogleAuth(cross,env)).status,403);
});

test('OAuth state is signed and callback refuses forged evidence of legal acceptance', async () => {
  const start = await handleGoogleAuth(consentRequest({return_to:'//evil.test'}),env);
  const cookie = cookieFrom(start,'__Host-forme_oauth_state');
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const [payload,signature] = cookie.split('=')[1].split('.');
  const content = JSON.parse(Buffer.from(payload,'base64url').toString());
  assert.equal(content.returnTo,'/closet');
  content.legalAcceptance.acceptedAt = '2000-01-01T00:00:00.000Z';
  const forged = `__Host-forme_oauth_state=${Buffer.from(JSON.stringify(content)).toString('base64url')}.${signature}`;
  const callback = new Request(`https://forme.gallery/auth/google/callback?code=test&state=${state}`,{headers:{cookie:forged}});
  assert.equal((await handleGoogleAuth(callback,env)).status,400);
  assert.equal((await handleGoogleAuth(new Request(callback.url,{headers:{cookie:`__Host-forme_oauth_state=${payload}`}}),env)).status,400);
});

test('verified sign-in carries consent; an existing session accepts without another Google redirect', async () => {
  const login = await completeLogin(handleGoogleAuth);
  const cookie = cookieFrom(login,'__Host-forme_session');
  assert.equal(login.headers.get('location'),'/closet');
  const identity = await readNativeSession(new Request('https://forme.gallery',{headers:{cookie}}),env.SESSION_SECRET);
  assert.equal(identity.legalAcceptance.version,version);
  assert.ok(Date.parse(identity.legalAcceptance.acceptedAt));
  const renewed = await handleGoogleAuth(consentRequest({return_to:'/canvas'},{cookie}),env);
  assert.equal(renewed.headers.get('location'),'/canvas');
  assert.ok(cookieFrom(renewed,'__Host-forme_session'));
});

test('acceptance is recorded against the authenticated account once; old users cannot create content without accepting', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const dir = new URL('../drizzle/',import.meta.url);
    for (const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) sqlite.exec(await readFile(new URL(name,dir),'utf8'));
    const DB = {prepare(sql) {const statement=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async first(){return statement.get(...values)??null;},async all(){return {results:statement.all(...values)};},async run(){statement.run(...values);return {success:true};}};}};
    const api = request => handleWardrobeApi(request,{...env,DB},{waitUntil(){}});
    const oldHeaders = {'oai-authenticated-user-email':'old@example.test'};
    assert.equal((await api(new Request('https://forme.gallery/api/session',{headers:oldHeaders}))).status,401);
    assert.equal((await api(new Request('https://forme.gallery/api/garments/piece',{method:'PUT',headers:oldHeaders,body:'{}'}))).status,401);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM users').get().n,0);
    const login=await completeLogin(handleGoogleAuth);
    const cookie=cookieFrom(login,'__Host-forme_session');
    for (let i=0;i<2;i++) assert.equal((await api(new Request('https://forme.gallery/api/session',{headers:{cookie}}))).status,200);
    const rows=sqlite.prepare('SELECT a.*, u.email FROM user_legal_acceptances a JOIN users u ON u.id=a.owner_id').all();
    assert.equal(rows.length,1); assert.equal(rows[0].version,version);assert.equal(rows[0].email,'legal@example.test');
    assert.equal((await api(new Request('https://forme.gallery/api/session',{headers:oldHeaders}))).status,401);
    // Local preview bypasses the gate but never fabricates a user's acceptance.
    await api(new Request('http://localhost/api/session'));
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM user_legal_acceptances').get().n,1);
  } finally {sqlite.close();}
});

test('public images are not cached and withdrawing profile visibility denies subsequent requests', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const dir = new URL('../drizzle/',import.meta.url);
    for (const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()) sqlite.exec(await readFile(new URL(name,dir),'utf8'));
    sqlite.exec("INSERT INTO users (id,email,handle,profile_public,show_closet) VALUES ('owner','owner@example.test','public-test',1,1)");
    sqlite.exec("INSERT INTO garments (id,owner_id,client_id,name,category,color_family,tone,material,finish,silhouette,is_public,image_key) VALUES ('item','owner','item','Top','Tops','white','light','cotton','matte','regular',1,'test-image')");
    const DB={prepare(sql){const stmt=sqlite.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async first(){return stmt.get(...values)??null;}};}};
    const WARDROBE_MEDIA={async get(){return {body:'image',httpEtag:'test',writeHttpMetadata(headers){headers.set('content-type','image/webp');}};}};
    const request=()=>new Request('https://forme.gallery/api/public-media/public-test/item/cutout');
    const response=await handleWardrobeApi(request(),{DB,WARDROBE_MEDIA},{waitUntil(){}});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'private, no-store');
    sqlite.exec("UPDATE users SET profile_public=0 WHERE id='owner'");
    assert.equal((await handleWardrobeApi(request(),{DB,WARDROBE_MEDIA},{waitUntil(){}})).status,404);
  } finally {sqlite.close();}
});
