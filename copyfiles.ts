/*
    copyfiles: copy files from source to destination dir
      srcDir?: string - base dir to copy from (default: @targetsources:)
      dstDir?: string - base dir to copy to (default: @targetassets:)
      files: string[] - list of files to copy

    First import the job like this:

    imports: {
        utils: {
            url: 'https://github.com/floooh/fibs-utils',
            import: [ 'copyfiles.ts' ]
        }
    },

    Now you can run 'fibs list jobs' to get a description of the

    Then add a build job to any targets which need to copy files:

    jobs: [
        {
            job: 'copyfiles',
            args: {
                srcDir: '@targetsources:assets',
                files: [ 'bla.png', 'blub.png' ],
            }
        }
    ]
*/

import { fs, path, fibs } from './deps.ts';

export const project: fibs.ProjectDesc = {
    jobs: [
        { name: 'copyfiles', help, validate, builder },
    ]
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

function builder(args: CopyFilesArgs): fibs.JobFunc {
    const {
        srcDir = '@targetsources:',
        dstDir = '@targetassets:',
        files,
    } = args;
    return (ctx): fibs.Job => {
        return {
            name: 'copyfiles',
            inputs: files.map((file) => fibs.util.resolvePath(ctx.aliasMap, srcDir, file)),
            outputs: files.map((file) => fibs.util.resolvePath(ctx.aliasMap, dstDir, file)),
            addOutputsToTargetSources: false,
            args: { srcDir, dstDir, files },
            func: async (inputs: string[], outputs: string[], _args: CopyFilesArgs): Promise<void> => {
                if (fibs.util.dirty(inputs, outputs)) {
                    for (let i = 0; i < inputs.length; i++) {
                        const from = inputs[i];
                        const to = outputs[i];
                        fibs.log.info(`# cp ${from} ${to}`);
                        await fs.ensureDir(path.dirname(to));
                        await fs.copy(from, to, { overwrite: true });
                    }
                }
            },
        };
    };
}
