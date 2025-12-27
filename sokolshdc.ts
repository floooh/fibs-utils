/*
    sokolshdc: fibs job definitions for the Sokol shader compiler.

    // FIXME: description
*/
import * as fibs from '@floooh/fibs';
import * as fs from '@std/fs';
import * as path from '@std/path';

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

export function configure(c: fibs.Configurer) {
    c.addImport({
        name: 'sokol-shdc',
        url: 'https://github.com/floooh/sokol-tools-bin',
    });
    c.addJob({ name: 'sokolshdc', help, validate, build: buildJob });
}

function help() {
    fibs.log.helpJob('sokolshdc', [
        { name: 'srcDir?', type: 'string', desc: 'optional source directory (default: target.dir)' },
        { name: 'outDir?', type: 'string', desc: 'optional output directory (default: project.targetBuildDir())' },
        { name: 'src', type: 'string', desc: 'GLSL source path (relative to srcDir)' },
        { name: 'out?', type: 'string', desc: 'optional output filename (default: derived from src)' },
        { name: 'slang?', type: 'string', desc: 'optional output shader language arg (default: dervived from build config)' },
        { name: 'fmt?', type: 'string', desc: 'optional output format (default: sokol)' },
        { name: 'defines?', type: 'string[]', desc: 'optional shader compilation definitions' },
        { name: 'module?', type: 'string', desc: 'optional module prefix override' },
        { name: 'reflection?', type: 'boolean', desc: 'enable/disable reflection generation' },
        { name: 'errfmt?', type: 'string', desc: 'error output format (gcc or msvc)' },
    ], 'run sokol shader compiler');
}

function validate(args: SokolShdcArgs) {
    return fibs.util.validateArgs(args, {
        srcDir: { type: 'string', optional: true },
        outDir: { type: 'string', optional: true },
        src: { type: 'string', optional: false },
        out: { type: 'string', optional: true },
        slang: { type: 'string', optional: false },
        fmt: { type: 'string', optional: true },
        defines: { type: 'string[]', optional: true },
        module: { type: 'string', optional: true },
        reflection: { type: 'boolean', optional: true },
        errfmt: { type: 'string', optional: true },
    });
}

function buildJob(p: fibs.Project, c: fibs.Config, t: fibs.Target, args: SokolShdcArgs) {
    const {
        srcDir = t.dir,
        outDir = p.targetBuildDir(t.name, c.name),
        src,
        out = `${path.basename(src)}.h`,
        slang = getDefaultSlang(p),
        fmt = 'sokol',
        defines,
        module,
        reflection = false,
        errfmt,
    } = args;
    return {
        name: 'sokolshdc',
        inputs: [`${srcDir}/${src}`],
        outputs: [`${outDir}/${out}`],
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
                    slang,
                    '--errfmt',
                    getErrFmt(p, errfmt),
                    '--format',
                    fmt,
                    '--bytecode',
                ];
                if (defines !== undefined) {
                    shdcArgs.push('--defines', ...defines);
                }
                if (module !== undefined) {
                    shdcArgs.push('--module', module);
                }
                if (reflection === true) {
                    shdcArgs.push('--reflection');
                }
                const res = await fibs.util.runCmd(getShdcPath(p), {
                    args: shdcArgs,
                    cwd: p.dir(),
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
}

function getShdcPath(p: fibs.Project): string {
    let dir;
    if (p.isHostWindows()) {
        dir = 'win32';
    } else if (p.isHostMacOS()) {
        dir = (p.hostArch() === 'arm64') ? 'osx_arm64' : 'osx';
    } else {
        dir = 'linux';
    }
    return `${p.importsDir()}/sokol-tools-bin/bin/${dir}/sokol-shdc`;
}

function getDefaultSlang(p: fibs.Project): string {
    if (p.findCompileDefinition('SOKOL_GLCORE')) {
        fibs.log.info('# sokolshdc: found SOKOL_GLCORE definition, using glsl430');
        return 'glsl430';
    } else if (p.findCompileDefinition('SOKOL_GLES3')) {
        if (p.isAndroid()) {
            fibs.log.info('# sokolshdc: found SOKOL_GLES3 definition and android platform, using glsl310es');
            return 'glsl310es';
        } else {
            fibs.log.info('# sokolshdc: found SOKOL_GLES3 definition, using glsl300es');
            return 'glsl300es';
        }
    } else if (p.findCompileDefinition('SOKOL_D3D11')) {
        fibs.log.info('# sokolshdc: found SOKOL_D3D11 definition, using hlsl5');
        return 'hlsl5';
    } else if (p.findCompileDefinition('SOKOL_METAL')) {
        if (p.isMacOS()) {
            fibs.log.info('# sokolshdc: found SOKOL_METAL definition and macos platform, using metal_macos');
            return 'metal_macos';
        } else {
            fibs.log.info('# sokolshdc: found SOKOL_METAL definition and ios platform, using metal_ios');
            return 'metal_ios';
        }
    } else if (p.findCompileDefinition('SOKOL_WGPU')) {
        fibs.log.info('# sokolshdc: found SOKOL_WGPU definition, using wgsl');
        return 'wgsl';
    } else if (p.findCompileDefinition('SOKOL_VULKAN')) {
        fibs.log.info('# sokolshdc: found SOKOL_VULKAN definition, using spirv_vk');
        return 'spirv_vk';
    } else {
        // no platform definition found, use
        let slang = 'glsl430'
        switch (p.platform()) {
            case 'macos': slang = 'metal_macos'; break;
            case 'ios': slang = 'metal_ios'; break;
            case 'windows': slang = 'hlsl5'; break;
            case 'emscripten': slang = 'glsl300es'; break;
            case 'android': slang = 'glsl300es'; break;
        }
        fibs.log.info(`# sokolshdc: no SOKOL_* backend definition found, selected ${slang}`);
        return slang;
    }
}

function getErrFmt(p: fibs.Project, errfmt: string | undefined): string {
    if (errfmt !== undefined) {
        return errfmt;
    } else if (p.isMsvc()) {
        return 'msvc';
    } else {
        return 'gcc';
    }
}
