
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
export default {
    input: 'src/index.js',
    output: {
        file: 'lib/index.js',
        format:'es'
    },
    plugins: [
        resolve(),
        commonjs(),
        json()
    ]
}