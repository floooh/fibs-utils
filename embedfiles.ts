/*
    FIXME: describe embedfiles
*/

import { fibs, fs, path } from './deps.ts';

export const project: fibs.ProjectDesc = {
  jobs: [
    { name: 'embedfiles', help, validate, builder },
  ],
};

function help() {
  fibs.log.helpJob('embedfiles', [
    { name: 'dir?', type: 'string', desc: 'base directory of files to embed (default: @targetsources)' },
    { name: 'files', type: 'string[]', desc: 'list of files to embed' },
    { name: 'outHeader', type: 'string', desc: 'path of generated header file' },
    { name: 'prefix?', type: 'string', desc: 'optional prefix for C array name (default: \'embed_\')' },
    { name: 'list?', type: 'boolean', desc: 'if true, generate a table of content' },
  ], 'generate C header with embedded binary file data');
}

type EmbedFilesArgs = {
  dir?: string;
  files: string[];
  outHeader: string;
  prefix?: string;
  list?: boolean;
};

type Item = {
  name: string;
  cname: string;
  size: number;
};

export function validate(args: EmbedFilesArgs): fibs.JobValidateResult {
  const res = fibs.util.validateArgs(args, {
    dir: { type: 'string', optional: true },
    files: { type: 'string[]', optional: false },
    outHeader: { type: 'string', optional: false },
    prefix: { type: 'string', optional: true },
    list: { type: 'boolean', optional: true },
  });
  return {
    valid: res.valid,
    hints: res.hints,
  };
}

export function builder(args: EmbedFilesArgs): fibs.JobFunc {
  const {
    dir = '@targetsources',
    files,
    outHeader,
    prefix = 'embed_',
    list = false,
  } = args;
  return (ctx: fibs.Context): fibs.Job => {
    return {
      name: 'embedfile',
      inputs: files.map((file) => fibs.util.resolvePath(ctx.aliasMap, dir, file)),
      outputs: [fibs.util.resolvePath(ctx.aliasMap, outHeader)],
      addOutputsToTargetSources: true,
      args: { dir, files, outHeader, prefix, list },
      func: async (inputs: string[], outputs: string[], args: EmbedFilesArgs): Promise<void> => {
        if (!fibs.util.dirty(inputs, outputs)) {
          return;
        }
        await fs.ensureDir(path.dirname(outputs[0]));
        let items: Item[] = [];
        let str = '';
        str += '#pragma once\n';
        str += '// machine generated, do not edit!\n';
        str += '#include <stdint.h>\n';
        str += '#include <stddef.h>\n';
        for (const input of inputs) {
          fibs.log.info(`# embed ${input} => ${outputs[0]}`);
          const bytes = await Deno.readFile(input);
          const name = path.basename(input).replace('.', '_');
          const cname = `${args.prefix}${name}`;
          items.push({ name, cname, size: bytes.length });
          str += `static const uint8_t ${cname}[${bytes.length}] = {\n`;
          for (const [i, byte] of bytes.entries()) {
            str += `0x${byte.toString(16).padStart(2, '0')}, `;
            if (((i + 1) % 16) === 0) {
              str += '\n';
            }
          }
          str += '\n};\n';
        }
        if (args.list) {
          str += `typedef struct { const char* name; const uint8_t* ptr; size_t size; } ${args.prefix}item_t;\n`;
          const numItemsDefine = `${args.prefix!.toUpperCase()}NUM_ITEMS`;
          str += `#define ${numItemsDefine} (${inputs.length})\n`;
          str += `static const ${args.prefix}item_t ${args.prefix}items[${numItemsDefine}] = {\n`;
          items = items.toSorted((a, b) => a.name.localeCompare(b.name));
          for (const item of items) {
            str += `{ "${item.name}", ${item.cname}, ${item.size} },\n`;
          }
          str += '};\n';
        }
        await Deno.writeTextFile(outputs[0], str);
      },
    };
  };
}
