/**
 * Single source of truth for where a concept's files live and how far along it is.
 * The state is derived from the files in the repository (not from anything the
 * agent claims), so it survives failed runs and cannot be faked.
 */
import fs from 'node:fs';

export const slugOf = (c) => c.slug || String(c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const pascalOf = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');

export function pathsOf(slug) {
  const Name = pascalOf(slug);
  return {
    physics: `src/physics/mechanics/${slug}.ts`,
    test: `src/tests/${slug}.test.ts`,
    pageDir: `src/simulations/${slug}`,
    page: `src/simulations/${slug}/${Name}Page.tsx`,
    component: `${Name}Page`,
  };
}

const read = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

/** 1 = needs physics+tests, 2 = needs page + registration, 3 = only bookkeeping left (no AI needed). */
export function phaseOf(slug) {
  const p = pathsOf(slug);
  if (!fs.existsSync(p.physics)) return 1;
  const pageExists = fs.existsSync(p.pageDir) && fs.readdirSync(p.pageDir).some((f) => f.endsWith('.tsx'));
  const registered = read('src/App.tsx').includes(`simulations/${slug}/`);
  if (!pageExists || !registered) return 2;
  return 3;
}

/** True when physics module, page and route all exist for this slug. */
export function integrated(slug) {
  return phaseOf(slug) === 3;
}
