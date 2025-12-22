/*
    sokolshdc: fibs job definitions for the Sokol shader compiler.

    // FIXME: description
*/
import { fibs, fs, path } from './deps.ts';

const VERSION = 1;

type SokolShdcArgs = {
    srcDir?: string;
    outDir?: string;
    src: string;
    out?: string;
    slang: string;
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
        { name: 'srcDir?', type: 'string', desc: 'optional source directory (default: @targetdir:)' },
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

function buildJob(args: SokolShdcArgs) {
    const {
        srcDir = '@targetdir:',
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
    return (p: fibs.Project, t: fibs.Target): fibs.Job => ({
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
    });
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

function getErrFmt(p: fibs.Project, errfmt: string | undefined): string {
    if (errfmt !== undefined) {
        return errfmt;
    } else if (p.isMsvc()) {
        return 'msvc';
    } else {
        return 'gcc';
    }
}
