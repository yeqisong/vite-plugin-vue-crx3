import { rollup } from 'rollup'
import { vf } from './vf'
export async function mixinChunksForIIFE (plugin, chunk, bundle) {
    // 使用rollup.rollup对js进行打包为iife，由于还没生成dist需要插件根据bundle获取到当前的chunk内容
    const bd = await rollup({
        input  : chunk.fileName,
        plugins: [vf(bundle)]
    })
    // 生成新的bundle
    const { output: outputs } = await bd.generate({
        format: 'iife'
    })
    // 只能有唯一的输出
    if (outputs.length < 1) {
        throw new Error('mix content no exits.')
    } else if (outputs.length > 1) {
        throw new Error('mix content script chunks error: output must contain only one chunk.')
    }
    // 增加输出文件(iife格式的js文件)
    const outputChunk = outputs[0]
    const referenceId = plugin.emitFile({
        type    : 'asset',
        source  : outputChunk.code,
        fileName: chunk.fileName
    })
    return plugin.getFileName(referenceId)
}
