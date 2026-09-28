import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
export const env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', SESSION_SECRET: 'test-session' };
export const version = '2026-09-28';
export async function bundleModule(path) {
  const output = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm', loader: {'.wasm':'binary'}, logLevel: 'silent', plugins: [{ name: 'confirmed-test-operator', setup(build) {
    build.onLoad({filter:/legal-operator\.json$/}, () => ({loader:'json',contents:JSON.stringify({name:'Operador de prueba',address:'Dirección de prueba, Perú',email:'legal@example.test',country:'Perú'})}));
  } }] });
  return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
}
export function consentRequest(values = {}, options = {}) {
  const origin = options.origin || 'https://forme.gallery';
  return new Request(`${origin}/auth/google/start`, { method:'POST', headers:{origin,'content-type':'application/x-www-form-urlencoded',...(options.cookie?{cookie:options.cookie}:{})}, body:new URLSearchParams({version,terms:'yes',privacy:'yes',...values}) });
}
export function cookieFrom(response, name) {
  return response.headers.getSetCookie().find(value => value.startsWith(`${name}=`))?.split(';')[0];
}
export async function completeLogin(auth, email = 'legal@example.test') {
  const start = await auth(consentRequest(), env);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const cookie = cookieFrom(start, '__Host-forme_oauth_state');
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => new Response(JSON.stringify(String(url).includes('/token') ? {access_token:'test'} : {sub:email,email,email_verified:true,name:'Test User',picture:null}),{headers:{'content-type':'application/json'}});
  try {
    return await auth(new Request(`https://forme.gallery/auth/google/callback?code=test&state=${state}`,{headers:{cookie}}),env);
  } finally { globalThis.fetch = oldFetch; }
}
