/*
    FIXME: describe embedfiles
*/
import { Config, Configurer, log, Project, Schema, Target, util } from 'jsr:@floooh/fibs';
import { basename, dirname } from 'jsr:@std/path';

type Args = {
    dir?: string;
    files: string[];
    outHeader: string;
    prefix?: string;
    list?: boolean;
    asText?: boolean;
    asConst?: boolean;
};

const schema: Schema = {
    dir: { type: 'string', optional: true, desc: 'base dir of files to embed (default: target source dir)' },
    files: { type: 'string[]', optional: false, desc: 'list of files to embed' },
    outHeader: { type: 'string', optional: false, desc: 'path of generated header file' },
    prefix: { type: 'string', optional: true, desc: 'optional prefix for C array name (default: embed_)' },
    list: { type: 'boolean', optional: true, desc: 'if true, generate a table of content' },
    asText: { type: 'boolean', optional: true, desc: 'if true, embed as zero-terminated string' },
    asConst: { type: 'boolean', optional: true, desc: 'if true, emit const data (default: true)' },
};

export function configure(c: Configurer) {
    c.addJob({ name: 'embedfiles', help, validate, build: buildJob });
}

function help() {
    log.helpJob('embedfiles', 'generate C header with embedded binary file data', schema);
}

function validate(args: unknown) {
    return util.validate(args, schema);
}

function buildJob(p: Project, c: Config, t: Target, args: unknown) {
    const {
        dir = t.dir,
        files,
        outHeader,
        prefix = 'embed_',
        list = false,
        asText = false,
        asConst = true,
    } = util.safeCast<Args>(args, schema);
    return {
        name: 'embedfiles',
        inputs: files.map((file) => `${dir}/${file}`),
        outputs: [`${dir}/${outHeader}`],
        addOutputsToTargetSources: true,
        args: { dir, files, outHeader, prefix, list, asText },
        func: async (inputs: string[], outputs: string[], args: Args): Promise<void> => {
            if (!util.dirty(inputs, outputs)) {
                return;
            }
            util.ensureDir(dirname(outputs[0]));
            let items: { name: string; cname: string; size: number }[] = [];
            let str = '';
            str += '#pragma once\n';
            str += '// machine generated, do not edit!\n';
            str += '#include <stdint.h>\n';
            str += '#include <stddef.h>\n';
            for (const input of inputs) {
                log.info(`# embed ${input} => ${outputs[0]}`);
                const bytes = await Deno.readFile(input);
                const name = basename(input).replace('.', '_');
                const cname = `${args.prefix}${name}`;
                const constStr = asConst ? 'const ' : '';
                items.push({ name, cname, size: bytes.length });
                if (args.asText) {
                    str += `static ${constStr}char ${cname}[${bytes.length + 1}] = {\n`;
                } else {
                    str += `static ${constStr}uint8_t ${cname}[${bytes.length}] = {\n`;
                }
                for (const [i, byte] of bytes.entries()) {
                    str += `0x${byte.toString(16).padStart(2, '0')}, `;
                    if (((i + 1) % 16) === 0) {
                        str += '\n';
                    }
                }
                if (args.asText) {
                    str += '0\n};\n';
                } else {
                    str += '\n};\n';
                }
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
}
