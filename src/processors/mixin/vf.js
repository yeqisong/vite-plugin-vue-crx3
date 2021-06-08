import { dirname, join } from 'path'
export function vf (bundle) {
    return {
        name: 'rollup-plugin-vf',
        resolveId (source, importer) {
            try {
                if (typeof importer === 'undefined') {
                    return source
                } else {
                    const dir = dirname(importer)
                    const resolved = join(dir, source)
                    return resolved in bundle ? resolved : false
                }
            } catch (error) {
                console.log('resolveId', error)
                return null
            }
        },
        load (id) {
            const chunk = bundle[id]
            if (chunk) {
                // remove chunk from bundle
                if (Object.values(bundle).filter(c => c.type === 'chunk' && c.imports.includes(chunk.fileName)).length < 1) {
                    delete bundle[id]
                }
                return {
                    code: chunk.code,
                    map : chunk.map
                }
            } else {
                return null
            }
        }
    }
}
