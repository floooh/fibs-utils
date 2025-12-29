// a collection of 'opinionated' standard compile options for inclusion in other projects
import { Builder } from 'jsr:@floooh/fibs';

export function build(b: Builder) {
    if (b.isMsvc()) {
        b.addCompileOptions(['/W4']);
        b.addCompileDefinitions({ _CRT_SECURE_NO_WARNINGS: '1' });
    } else {
        b.addCompileOptions(['-Wall', '-Wextra']);
    }
}
