import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const result = await build({ entryPoints: [fileURLToPath(new URL('../app/canvas-document.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
const { CanvasHistory, snapshotLook, readCanvasDraft } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const pieces = [
  { instanceId: 'trousers', garmentId: 'jeans', variant: 'closed', x: 50, y: 60, rotation: 12, scale: .8, z: 8 },
  { instanceId: 'top', garmentId: 'tee', variant: 'open', x: 48, y: 30, rotation: -5, scale: .5, z: 2 },
];
const original = { id: 'saved-look', name: 'Mi look', items: pieces };
test('snapshot preserves every garment, coordinate, variant and manual layer order', () => {
  const snapshot = snapshotLook(pieces);
  assert.deepEqual(snapshot, pieces);
  snapshot[0].x = 5;
  assert.equal(pieces[0].x, 50, 'snapshot changes must not mutate the editor');
});
test('new look can be undone with the original name, saved identity and composition', () => {
  const history = new CanvasHistory();
  history.checkpoint(original);
  const empty = { id: null, name: 'Nuevo look', items: [] };
  assert.deepEqual(history.undo(empty), original);
  assert.deepEqual(history.redo(original), empty);
});
test('duplicate selection checkpoints do not require extra undo steps', () => {
  const history = new CanvasHistory();
  history.checkpoint(original); history.checkpoint(original);
  const changed = { ...original, items: pieces.map(p => ({ ...p, z: p.z === 8 ? 1 : 2 })) };
  assert.deepEqual(history.undo(changed), original);
  assert.equal(history.undo(original), null);
});
test('a new edit after undo clears the abandoned redo branch', () => {
  const history = new CanvasHistory();
  history.checkpoint(original);
  history.undo({ ...original, name: 'Cambio' });
  history.checkpoint(original);
  assert.equal(history.redo(original), null);
});
test('session drafts reject corrupt coordinates, duplicate IDs and incomplete documents', () => {
  assert.deepEqual(readCanvasDraft(original), original);
  for (const invalid of [null, {}, {...original, items:[pieces[0],pieces[0]]}, {...original,items:[{...pieces[0],x:NaN}]}, {...original,items:[{...pieces[0],variant:'broken'}]}]) assert.equal(readCanvasDraft(invalid),null);
});
test('history remains bounded across a long editing session', () => {
  const history = new CanvasHistory();
  for (let i = 0; i < 80; i++) history.checkpoint({...original,name:`Look ${i}`});
  assert.equal(history.past.length,50);
});
