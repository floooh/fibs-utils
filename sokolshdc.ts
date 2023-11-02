/*
    sokolshdc: fibs job definitions for the Sokol shader compiler.

    // FIXME: description
*/
import * as fs from '$std/fs/mod.ts';
import * as path from '$std/path/mod.ts';
import * as fibs from '$fibs/mod.ts';

const VERSION = 1;

type SokolShdcArgs = {
  srcDir?: string;
  outDir?: string;
  src: string;
  out?: string;
  slang?: string;
  fmt?: string;
  defines?: string[];
  module?: string;
  reflection?: boolean;
  errfmt?: string;
};

export const project: fibs.ProjectDesc = {
  imports: [
    {
      name: 'sokol-shdc',
      url: 'https://github.com/floooh/sokol-tools-bin',
    },
  ],
  jobs: [
    {
      'name': 'sokolshdc',
      help: () => {
        fibs.log.helpJob('sokolshdc', [
          { name: 'srcDir?', type: 'string', desc: 'optional source directory (default: @targetsources:)' },
          { name: 'outDir?', type: 'string', desc: 'optional output directory (default: @targetbuild:)' },
          { name: 'src', type: 'string', desc: 'GLSL source path (relative to srcDir)' },
          { name: 'out?', type: 'string', desc: 'optional output filename (default: derived from src)' },
          { name: 'slang?', type: 'string', desc: 'optional output shader language arg (default: derived from build config)' },
          { name: 'fmt?', type: 'string', desc: 'optional output format (default: sokol)' },
          { name: 'defines?', type: 'string[]', desc: 'optional shader compilation definitions' },
          { name: 'module?', type: 'string', desc: 'optional module prefix override' },
          { name: 'reflection?', type: 'boolean', desc: 'enable/disable reflection generation' },
          { name: 'errfmt?', type: 'string', desc: 'error output format (gcc or msvc)' },
        ], 'run sokol shader compiler');
      },
      validate: (args: SokolShdcArgs) => {
        const res = fibs.util.validateArgs(args, {
          srcDir: { type: 'string', optional: true },
          outDir: { type: 'string', optional: true },
          src: { type: 'string', optional: false },
          out: { type: 'string', optional: true },
          slang: { type: 'string', optional: true },
          fmt: { type: 'string', optional: true },
          defines: { type: 'string[]', optional: true },
          module: { type: 'string', optional: true },
          reflection: { type: 'boolean', optional: true },
          errfmt: { type: 'string', optional: true },
        });
        return { valid: res.valid, hints: res.hints };
      },
      builder: (args: SokolShdcArgs) => {
        const {
          srcDir = '@targetsources:',
          outDir = '@targetbuild:',
          src,
          out = `${path.basename(src)}.h`,
          slang,
          fmt = 'sokol',
          defines,
          module,
          reflection = false,
          errfmt,
        } = args;
        return (ctx) => {
          return {
            name: 'sokolshdc',
            inputs: [fibs.util.resolvePath(ctx.aliasMap, srcDir, src)],
            outputs: [fibs.util.resolvePath(ctx.aliasMap, outDir, out)],
            addOutputsToTargetSources: true,
            args: {
              srcDir,
              outDir,
              src,
              out,
              slang,
              fmt,
              defines,
              module,
              reflection,
              errfmt,
            },
            func: async (inputs: string[], outputs: string[], args: SokolShdcArgs) => {
              if (fibs.util.dirty(inputs, outputs)) {
                await fs.ensureDir(path.dirname(outputs[0]));
                const shdcArgs = [
                  '--input',
                  inputs[0],
                  '--output',
                  outputs[0],
                  '--genver',
                  `${VERSION}`,
                  '--slang',
                  getSlang(ctx, args.slang),
                  '--errfmt',
                  getErrFmt(ctx, args.errfmt),
                  '--format',
                  args.fmt!,
                  '--bytecode',
                ];
                if (args.defines !== undefined) {
                  shdcArgs.push('--defines', ...args.defines);
                }
                if (args.module !== undefined) {
                  shdcArgs.push('--module', args.module);
                }
                if (args.reflection === true) {
                  shdcArgs.push('--reflection');
                }
                const res = await fibs.util.runCmd(getShdcPath(ctx), {
                  args: shdcArgs,
                  cwd: ctx.project.dir,
                  showCmd: true,
                  abortOnError: false,
                  winUseCmd: true,
                });
                if (res.exitCode !== 0) {
                  throw new Error(`sokol-shdc failed with exit code ${res.exitCode}`);
                }
              }
            },
          };
        };
      },
    },
  ],
};

function getShdcPath(ctx: fibs.Context): string {
  const base = '@imports:sokol-tools-bin/bin';
  let dir;
  if (ctx.host.platform === 'windows') {
    dir = 'win32';
  } else if (ctx.host.platform === 'macos') {
    dir = (ctx.host.arch === 'arm64') ? 'osx_arm64' : 'osx';
  } else {
    dir = 'linux';
  }
  return fibs.util.resolvePath(ctx.aliasMap, base, dir, 'sokol-shdc');
}

function getSlang(ctx: fibs.Context, slang: string | undefined): string {
  if (slang !== undefined) {
    return slang;
  } else if (ctx.config.compileDefinitions.SOKOL_D3D11) {
    return 'hlsl4';
  } else if (ctx.config.compileDefinitions.SOKOL_GLCORE33) {
    return 'glsl330';
  } else if (ctx.config.compileDefinitions.SOKOL_METAL) {
    if (ctx.config.platform === 'macos') {
      return 'metal_macos';
    } else {
      return 'metal_ios:metal_sim';
    }
  } else if (ctx.config.compileDefinitions.SOKOL_GLES3) {
    return 'gles300es:glsl100';
  } else if (ctx.config.compileDefinitions.SOKOL_GLES2) {
    return 'glsl100';
  } else if (ctx.config.compileDefinitions.SOKOL_WGPU) {
    return 'wgpu';
  } else {
    fibs.log.warn('sokolshdc: cannot extract sokol backend from ctx.config.compileDefinitions');
    switch (ctx.config.platform) {
      case 'android':
        return 'gles300es:glsl100';
      case 'ios':
        return 'gles300es:metal_ios:metal_sim';
      case 'emscripten':
        return 'gles300es:glsl100:wgpu';
      case 'linux':
        return 'glsl330:gles300es';
      case 'macos':
        return 'metal_macos';
      case 'windows':
        return 'hlsl4:glsl330';
      default:
        return 'glsl330';
    }
  }
}

function getErrFmt(ctx: fibs.Context, errfmt: string | undefined): string {
  if (errfmt !== undefined) {
    return errfmt;
  } else {
    if (ctx.compiler === 'msvc') {
      return 'msvc';
    } else {
      return 'gcc';
    }
  }
}
