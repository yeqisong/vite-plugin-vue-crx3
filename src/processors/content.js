import { entryDef } from '../entry'
import { relative } from 'path'
import { findChunkByName, removeFileExtension, slash1 } from '../util/functions'
import { mixinChunksForIIFE } from './mixin'
export class ContentScriptProcessor {
    contentJs=[]
    /**
     * 强制修正manifest中配置的content.js[]的输出位置
     * @param {*} inputs
     * @param {*} manifest
     */
    distDir (inputs, manifest) {
        // 解析manifest.content_scripts中的js
        (manifest.content_scripts || []).forEach((contents, idx) => {
            // 解构每个contents的内容
            const { js:jss } = contents
            const njss = (jss || []).map(js => {
                // 保存到入口配置中
                entryDef.content.manifest.push(js)
                // 删除js后缀
                js = removeFileExtension(js)
                // 匹配inputs中的该js的路径配置
                let tkey = Object.keys(inputs).find(k => relative(slash1(k), slash1(js)) === '')
                // 如果匹配上，将js转为dist路径，并更新inputs，并删除inputs上原来配置
                if (tkey) {
                    let lastName = slash1(tkey).split('/').slice(-1)[0]
                    js = `${entryDef.content.dir}/${lastName}`
                    inputs[js] = inputs[tkey]
                    entryDef.content.dist.push(js)
                    delete inputs[tkey]
                }
                return `${js}.js`
            })
            // 替换manifest.cntent_scripts中对应索引中js配置
            if (njss) {
                manifest.content_scripts[idx].js = njss
            }
        })
        this.contentJs = entryDef.content.dist
    }
    /**
     * content-scripts全部js的iife处理
     * @param {*} plugin
     * @param {*} bundle
     * @param {*} manifest
     */
    async generateBundle (plugin, bundle, manifest) {
        // 打包为iife
        if (this.contentJs.length) {
            const distDirs = entryDef.content.dist
            for (const distDir of distDirs) {
                let chunk = findChunkByName(distDir, bundle)
                if (chunk) {
                    await mixinChunksForIIFE(plugin, chunk, bundle)
                }
            }
        }
    }
    async generateBundleFromDynamicImports (plugin, bundle, dyimports) {
        // 打包为iife
        for (const dyimport of dyimports) {
            const filename = plugin.getFileName(dyimport)
            const chunk = bundle[filename]
            if (chunk && chunk.type === 'chunk') {
                await mixinChunksForIIFE(plugin, chunk, bundle)
            }
        }
    }
}
