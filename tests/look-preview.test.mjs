import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../app/look-preview.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
const { fitLookPreview } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('thumbnail fit moves and scales the entire look together without changing the document or layers', () => {
  const items = [
    { id: 'coat', x: 80, y: 75, scale: 1.11261, rotation: 0, z: 3, variant: 'open' },
    { id: 'hat', x: 80.4074, y: 30.79206, scale: .40849, rotation: 0, z: 4, variant: 'closed' },
    { id: 'trousers', x: 80.0737, y: 92, scale: .993252, rotation: 0, z: 1, variant: 'closed' },
  ];
  const original = structuredClone(items);
  const fitted = fitLookPreview(items, () => [.1, .1, .8, .8]);
  assert.deepEqual(items, original);
  const ratio = fitted[0].scale / items[0].scale;
  for (let i = 0; i < items.length; i++) {
    close(fitted[i].scale / items[i].scale, ratio);
    close(fitted[i].x - fitted[0].x, (items[i].x - items[0].x) * ratio);
    close(fitted[i].y - fitted[0].y, (items[i].y - items[0].y) * ratio);
    for (const key of ['id', 'z', 'rotation', 'variant']) assert.equal(fitted[i][key], items[i][key]);
  }
  const left = Math.min(...fitted.map(p => p.x * 10 - .4 * 760 * p.scale));
  const right = Math.max(...fitted.map(p => p.x * 10 + .4 * 760 * p.scale));
  const top = Math.min(...fitted.map(p => p.y * 15 - .4 * 950 * p.scale));
  const bottom = Math.max(...fitted.map(p => p.y * 15 + .4 * 950 * p.scale));
  close(left + right, 1000); close(top + bottom, 1500);
  assert.ok(left >= 60 - 1e-8 && top >= 60 - 1e-8);
  assert.ok(Math.abs(left - 60) < 1e-8 || Math.abs(top - 60) < 1e-8);
});

test('an off-center cutout rotated 90 degrees is centered by its visible silhouette', () => {
  const [item] = fitLookPreview([{ x: -20, y: 130, scale: 3, rotation: 90, z: 7 }], () => [.1, .2, .4, .7]);
  // Visible center offset: (-.2 * 760, .05 * 950), rotated 90 degrees.
  close(item.x * 10 - .05 * 950 * item.scale, 500);
  close(item.y * 15 - .2 * 760 * item.scale, 750);
  close(.7 * 950 * item.scale, 880);
  assert.equal(item.rotation, 90); assert.equal(item.z, 7);
});

test('empty and invalid previews stay safe, and repeated preview fitting is stable', () => {
  assert.deepEqual(fitLookPreview([], () => undefined), []);
  const invalid = [{ x: 1, y: 2, scale: NaN, rotation: 0 }];
  assert.deepEqual(fitLookPreview(invalid, () => undefined), invalid);
  const items = [{ x: 33, y: 42, scale: .6, rotation: 42 }];
  const fitted = fitLookPreview(items, () => undefined);
  const again = fitLookPreview(fitted, () => undefined);
  for (const key of ['x','y','scale','rotation']) close(fitted[0][key], again[0][key]);
});
