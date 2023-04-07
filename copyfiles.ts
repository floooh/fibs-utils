import { fs, path, fibs } from './deps.ts';

export const project: fibs.ProjectDesc = {
    jobs: {
        'copyfiles': { help, validate, builder }
    }
}

function help() {
    fibs.log.helpJob('copyfiles', [
        { name: 'srcDir?', type: 'string', desc: 'base dir to copy from (default: @targetsources:)' },
        { name: 'dstDir?', type: 'string', desc: 'base dir to copy to (default: @targetassets:)' },
        { name: 'files', type: 'string[]', desc: 'list of files to copy' },
    ], 'copy files from source to destination dir');
}

type CopyFilesArgs = {
    srcDir?: string;
    dstDir?: string;
    files: string[];
};

function validate(args: CopyFilesArgs): fibs.JobValidateResult {
    const res = fibs.util.validateArgs(args, {
        srcDir: { type: 'string', optional: true },
        dstDir: { type: 'string', optional: true },
        files:  { type: 'string[]', optional: false },
    });
    return {
        valid: res.valid,
        hints: res.hints,
    }
}

function builder(args: CopyFilesArgs): fibs.JobBuilder {
    const {
        srcDir = '@targetsources:',
        dstDir = '@targetassets:',
        files,
    } = args;
    return (context: fibs.TargetBuildContext): fibs.Job => {
        const target = context.target;
        const aliasMap = fibs.util.buildAliasMap({
            project: context.project,
            config: context.config,
            target: context.target,
            selfDir: target.importDir
        });
        return {
            name: 'copyfiles',
            inputs: files.map((file) => fibs.util.resolvePath(aliasMap, srcDir, file)),
            outputs: files.map((file) => fibs.util.resolvePath(aliasMap, dstDir, file)),
            addOutputsToTargetSources: false,
            args: { srcDir, dstDir, files },
            func: async (inputs: string[], outputs: string[], args: CopyFilesArgs): Promise<void> => {
                if (fibs.util.dirty(inputs, outputs)) {
                    for (let i = 0; i < inputs.length; i++) {
                        const from = inputs[i];
                        const to = outputs[i];
                        fibs.log.info(`# cp ${from} ${to}`);
                        fs.ensureDirSync(path.dirname(to));
                        fs.copySync(from, to, { overwrite: true });
                    }
                }
            },
        };
    };
}
