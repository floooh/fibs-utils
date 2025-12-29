/*
    sokolshdc: fibs job definitions for the Sokol shader compiler.

    // FIXME: description
*/
import { Config, Configurer, log, Project, Schema, Target, util } from 'jsr:@floooh/fibs';
import { basename, dirname } from 'jsr:@std/path';

const VERSION = 1;

type Args = {
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

const schema: Schema = {
    srcDir: { type: 'string', optional: true, desc: 'optional source dir (default: target source dir)' },
    outDir: { type: 'string', optional: true, desc: 'optional output dir (default: target build dir)' },
    src: { type: 'string', optional: false, desc: 'GLSL source path (relative to srcDir)' },
    out: { type: 'string', optional: true, desc: 'optional output filename relative to outDir (default: derived from src' },
    slang: { type: 'string', optional: true, desc: 'optional shader language (default: derived from build config)' },
    fmt: { type: 'string', optional: true, desc: 'optional output format (default: sokol)' },
    defines: { type: 'string[]', optional: true, desc: 'optional shader compilation defines' },
    module: { type: 'string', optional: true, desc: 'optional module prefix override' },
    reflection: { type: 'boolean', optional: true, desc: 'enable/disable reflection generation (default: false)' },
    errfmt: { type: 'string', optional: true, desc: 'optional error output format' },
};

export function configure(c: Configurer) {
    c.addImport({
        name: 'sokol-shdc',
        url: 'https://github.com/floooh/sokol-tools-bin',
    });
    c.addJob({ name: 'sokolshdc', help, validate, build: buildJob });
}

function help() {
    log.helpJob('sokolshdc', 'run sokol shader compiler', schema);
}

function validate(args: unknown) {
    return util.validate(args, schema);
}

function buildJob(p: Project, c: Config, t: Target, args: unknown) {
    const {
        srcDir = t.dir,
        outDir = p.targetBuildDir(t.name, c.name),
        src,
        out = `${basename(src)}.h`,
        slang = getDefaultSlang(p),
        fmt = 'sokol',
        defines,
        module,
        reflection = false,
        errfmt,
    } = util.safeCast<Args>(args, schema);
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
        func: async (inputs: string[], outputs: string[], args: Args) => {
            if (util.dirty(inputs, outputs)) {
                util.ensureDir(dirname(outputs[0]));
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
                const res = await util.runCmd(getShdcPath(p), {
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

function getShdcPath(p: Project): string {
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

function getDefaultSlang(p: Project): string {
    if (p.findCompileDefinition('SOKOL_GLCORE')) {
        log.info('# sokolshdc: found SOKOL_GLCORE definition, using glsl430');
        return 'glsl430';
    } else if (p.findCompileDefinition('SOKOL_GLES3')) {
        if (p.isAndroid()) {
            log.info('# sokolshdc: found SOKOL_GLES3 definition and android platform, using glsl310es');
            return 'glsl310es';
        } else {
            log.info('# sokolshdc: found SOKOL_GLES3 definition, using glsl300es');
            return 'glsl300es';
        }
    } else if (p.findCompileDefinition('SOKOL_D3D11')) {
        log.info('# sokolshdc: found SOKOL_D3D11 definition, using hlsl5');
        return 'hlsl5';
    } else if (p.findCompileDefinition('SOKOL_METAL')) {
        if (p.isMacOS()) {
            log.info('# sokolshdc: found SOKOL_METAL definition and macos platform, using metal_macos');
            return 'metal_macos';
        } else {
            log.info('# sokolshdc: found SOKOL_METAL definition and ios platform, using metal_ios');
            return 'metal_ios';
        }
    } else if (p.findCompileDefinition('SOKOL_WGPU')) {
        log.info('# sokolshdc: found SOKOL_WGPU definition, using wgsl');
        return 'wgsl';
    } else if (p.findCompileDefinition('SOKOL_VULKAN')) {
        log.info('# sokolshdc: found SOKOL_VULKAN definition, using spirv_vk');
        return 'spirv_vk';
    } else {
        // no platform definition found, use
        let slang = 'glsl430';
        switch (p.platform()) {
            case 'macos':
                slang = 'metal_macos';
                break;
            case 'ios':
                slang = 'metal_ios';
                break;
            case 'windows':
                slang = 'hlsl5';
                break;
            case 'emscripten':
                slang = 'glsl300es';
                break;
            case 'android':
                slang = 'glsl300es';
                break;
        }
        log.info(`# sokolshdc: no SOKOL_* backend definition found, selected ${slang}`);
        return slang;
    }
}

function getErrFmt(p: Project, errfmt: string | undefined): string {
    if (errfmt !== undefined) {
        return errfmt;
    } else if (p.isMsvc()) {
        return 'msvc';
    } else {
        return 'gcc';
    }
}
