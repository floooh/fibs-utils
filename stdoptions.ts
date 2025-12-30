// a collection of 'opinionated' standard compile options for inclusion in other projects
import { Builder } from 'jsr:@floooh/fibs';

export function build(b: Builder) {
    if (b.isMsvc()) {
        b.addCompileOptions(['/W4', '/EHsc']);
        b.addCompileDefinitions({ _CRT_SECURE_NO_WARNINGS: '1' });
    } else {
        b.addCompileOptions(['-Wall', '-Wextra']);
        const common_cxx_opts = ['-fno-exceptions', '-fno-rtti'];
        b.addCompileOptions({ language: 'cxx', opts: common_cxx_opts });
        b.addLinkOptions({ language: 'cxx', opts: common_cxx_opts });
    }
}
