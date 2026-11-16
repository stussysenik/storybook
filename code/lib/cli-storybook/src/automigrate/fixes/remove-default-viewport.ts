import type { CsfObject } from 'storybook/internal/csf-tools';

import { readForEdit } from '../helpers/edit-parsed-file.ts';
import type { Fix } from '../types.ts';

const defaultViewportPath = ['parameters', 'viewport', 'defaultViewport'];

// The parameter is gone in Storybook 11; the migration guide points to the globals API.
const migrate = (object: CsfObject) => {
  if (readForEdit(object, defaultViewportPath)) {
    object.remove(defaultViewportPath);
  }
};

export const removeDefaultViewport: Fix = {
  id: 'remove-default-viewport',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#viewportdefaultviewport-parameter-and-responsiveviewport-removed',

  prompt: () =>
    'Remove deprecated parameters.viewport.defaultViewport. Set the viewport with the globals API instead.',

  transform: () => [
    {
      filter: { kind: ['preview', 'story'], code: 'defaultViewport' },
      editConfig: migrate,
      editCsf: (csf) => csf.objects().forEach(migrate),
    },
  ],
};
