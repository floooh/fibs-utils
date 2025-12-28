// a collection of 'opinionated' standard compile options for inclusion in other projects
import * as fibs from 'jsr:@floooh/fibs';

export function build(b: fibs.Builder) {
    if (b.isMsvc()) {
        b.addCompileOptions(['/W4']);
        b.addCompileDefinitions({ _CRT_SECURE_NO_WARNINGS: '1' });
    } else {
        b.addCompileOptions(['-Wall', '-Wextra']);
    }
}
