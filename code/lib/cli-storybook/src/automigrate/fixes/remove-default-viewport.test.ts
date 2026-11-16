import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { removeDefaultViewport } from './remove-default-viewport.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const previewConfigPath = resolve('.storybook/preview.ts');
const storyPath = resolve('src/Button.stories.ts');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath: resolve('.storybook/main.ts'),
  configDir: resolve('.storybook'),
  storybookVersion: '11.0.0',
  previewConfigPath,
  storiesPaths: [storyPath],
};

const migrate = async (files: { preview?: string; story?: string }) => {
  vol.fromJSON({ [previewConfigPath]: files.preview ?? '', [storyPath]: files.story ?? '' });
  const failures = await runFix(removeDefaultViewport, { ...options, result: {} });
  return {
    failures,
    preview: fs.readFileSync(previewConfigPath, 'utf8') as string,
    story: fs.readFileSync(storyPath, 'utf8') as string,
  };
};

describe('remove-default-viewport', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  it('applies only when a file uses defaultViewport', async () => {
    vol.fromJSON({ [previewConfigPath]: 'export default {};', [storyPath]: 'export default {};' });
    expect(await checkFix(removeDefaultViewport, options)).toBeNull();

    fs.writeFileSync(
      storyPath,
      "export default { parameters: { viewport: { defaultViewport: 'mobile1' } } };"
    );
    expect(await checkFix(removeDefaultViewport, options)).toEqual({});
  });

  it('removes defaultViewport from the preview and meta, keeping sibling parameters', async () => {
    const { failures, preview, story } = await migrate({
      preview:
        "export default { parameters: { viewport: { defaultViewport: 'mobile1' }, docs: {} } };",
      story: [
        "export default { parameters: { viewport: { defaultViewport: 'tablet' }, docs: { source: {} } } };",
        "export const Primary = { parameters: { viewport: { defaultViewport: 'mobile2' } } };",
      ].join('\n'),
    });

    expect(failures).toEqual([]);
    expect(preview).not.toContain('defaultViewport');
    expect(preview).toContain('docs: {}');
    expect(story).not.toContain('defaultViewport');
    expect(story).toContain('docs: { source: {} }');
  });

  it('reports a file it cannot migrate safely and leaves it untouched', async () => {
    const story =
      "import { shared } from './shared';\nexport default { parameters: { viewport: { ...shared, defaultViewport: 'mobile1' } } };";
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.any(String) },
    ]);
    expect(result.story).toBe(story);
  });
});
