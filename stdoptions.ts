// a collection of 'opinionated' standard compile options for inclusion in other projects
import { fibs } from './deps.ts';

export function build(b: fibs.Builder) {
    if (b.isMsvc()) {
        b.addCompileOptions(['/W4']);
    } else {
        b.addCompileOptions(['-Wall', '-Wextra']);
    }
}
