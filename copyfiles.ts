/*
    copyfiles: copy files from source to destination dir
      srcDir?: string - base dir to copy from (default: @targetdir:)
      dstDir?: string - base dir to copy to (default: @targetassets:)
      files: string[] - list of files to copy

    First import the job like this:

    c.addImport({
      name: 'utils',
      url: 'https://github.com/floooh/fibs-utils',
      files: ['copyfiles.ts'],
    });

    Now you can run 'fibs list jobs' to get a description of the imported
    copyfiles job.

    Then add a build job to any targets which need to copy files:

    b.addJob({
      job: 'copyfiles',
      args: {
          srcDir: '@targetdir:assets',
          files: [ 'bla.png', 'blub.png' ],
      },
    });
*/

import { fibs, fs, path } from './deps.ts';

type CopyFilesArgs = {
    srcDir?: string;
    dstDir?: string;
    files: string[];
};

export function configure(c: fibs.Configurer) {
    c.addJob({ name: 'copyfiles', help, validate, build: buildJob });
}

function help() {
    fibs.log.helpJob('copyfiles', [
        { name: 'srcDir?', type: 'string', desc: 'base dir to copy from (default: @targetdir:)' },
        { name: 'dstDir?', type: 'string', desc: 'base dir to copy to (default: @targetassets:)' },
        { name: 'files', type: 'string[]', desc: 'list of files to copy' },
    ], 'copy files from source to destination dir');
}

function validate(args: CopyFilesArgs) {
    return fibs.util.validateArgs(args, {
        srcDir: { type: 'string', optional: true },
        dstDir: { type: 'string', optional: true },
        files: { type: 'string[]', optional: false },
    });
}

function buildJob(args: CopyFilesArgs) {
    const {
        srcDir = '@targetdir:',
        dstDir = '@targetassets:',
        files,
    } = args;
    return (p: fibs.Project, t: fibs.Target): fibs.Job => ({
        name: 'copyfiles',
        inputs: files.map((file) => `${srcDir}/${file}`),
        outputs: files.map((file) => `${dstDir}/${file}`),
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
    });
}
