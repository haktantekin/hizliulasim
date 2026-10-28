import assert from 'node:assert/strict';
import test from 'node:test';

test('builds every detail section heading from the selected minibus line name', async () => {
  const headingsModule: Partial<typeof import('./minibusDetailHeadings.ts')> = await import('./minibusDetailHeadings.ts').catch(() => ({}));
  const buildHeadings = headingsModule.buildMinibusDetailHeadings;

  assert.equal(typeof buildHeadings, 'function');
  assert.ok(buildHeadings);
  assert.deepEqual(
    buildHeadings('Bakırköy-Hastane-Esenler-Atışalanı'),
    {
      route: 'Bakırköy-Hastane-Esenler-Atışalanı Minibüs Güzergahı',
      schedule: 'Bakırköy-Hastane-Esenler-Atışalanı Minibüs Saatleri',
      stops: 'Bakırköy-Hastane-Esenler-Atışalanı Minibüs Durakları',
      fare: 'Bakırköy-Hastane-Esenler-Atışalanı Minibüs Ne Kadar',
    },
  );
});
