// a collection of 'opinionated' standard compile options for inclusion in other projects
import * as fibs from '$fibs/mod.ts';

export const project: fibs.ProjectDesc = {
  // language standards
  cmakeVariables: {
    CMAKE_C_STANDARD: '11',
    CMAKE_CXX_STANDARD: '14',
  },

  // increase warning levels
  compileOptions: (context) => {
    if (context.compiler === 'msvc') {
      return ['/W4'];
    } else {
      return ['-Wall', '-Wextra'];
    }
  },

  // on Emscripten, use our custom shell.html for all exe targets
  linkOptions: (context) => {
    if (context.config.platform === 'emscripten') {
      return ['--shell-file', '@imports:fibs-utils/shell.html'];
    } else {
      return [];
    }
  },
};
