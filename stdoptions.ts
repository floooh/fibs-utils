// a collection of 'opinionated' standard compile options for inclusion in other projects
import { Builder } from 'jsr:@floooh/fibs';

export function build(b: Builder) {
    if (b.isMsvc()) {
        b.addCompileOptions(['/W4', '/EHsc']);
        b.addCompileOptions({ opts: ['/O2'], buildMode: 'release' });
        b.addCompileDefinitions({ _CRT_SECURE_NO_WARNINGS: '1' });
        // link-time-code-generation flags
        b.addCompileOptions({ opts: ['/GL'], buildMode: 'release' });
        b.addLinkOptions({ opts: ['/LTCG'], buildMode: 'release' });
    } else {
        b.addCompileOptions(['-Wall', '-Wextra', '-Wno-missing-field-initializers']);
        b.addCompileOptions({ opts: ['-O3'], buildMode: 'release' });
        const common_release_opts = ['-flto'];
        b.addCompileOptions({ opts: common_release_opts, buildMode: 'release' });
        b.addLinkOptions({ opts: common_release_opts, buildMode: 'release' });
        const common_cxx_opts = ['-fno-exceptions', '-fno-rtti'];
        b.addCompileOptions({ opts: common_cxx_opts, language: 'cxx' });
        b.addLinkOptions({ opts: common_cxx_opts, language: 'cxx' });
    }
}
