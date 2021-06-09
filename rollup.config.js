
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { babel } from '@rollup/plugin-babel'
export default {
    input: 'src/index.js',
    external: ['rollup','lodash'],
    output: [{
        file: 'lib/es/index.js',
        format: 'es'
    }, {
        file: 'lib/cjs/index.js',
        format: 'cjs'
    }],
    plugins: [
        resolve(),
        commonjs(),
        json(),
        babel({
            babelHelpers: 'bundled',
            exclude: 'node_modules/'
        })
    ]
}