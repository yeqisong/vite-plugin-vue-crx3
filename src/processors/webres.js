import { entryDef } from '../entry'
import { join } from 'path'
import { findChunkByName, getRes4Webaccessres, isString} from '../util/functions'
import { mixinChunksForIIFE } from './mixin'
import { input2kuFunction } from '../manifest/input2kvfun'
export class WebresProcessor {
    resJs=[]
    /**
     * 获取web_access资源并缓存
     * @param {*} inputs
     * @param {*} manifest
     */
    distDir (inputs, manifest, srcDir) {
        const validate = ary => [...new Set(ary.filter(f => isString(f)))].map(x => join(srcDir, x))
        const a = validate(getRes4Webaccessres(manifest, srcDir)).reduce(input2kuFunction(srcDir), {})
        this.resJs = entryDef.webres.dist = Object.keys(a) || []
    }
    /**
     * webres资源iife处理
     * @param {*} plugin
     * @param {*} bundle
     * @param {*} manifest
     */
    async generateBundle (plugin, bundle, manifest) {
        // 打包为iife
        if (this.resJs.length) {
            const distDirs = entryDef.webres.dist
            for (const distDir of distDirs) {
                let chunk = findChunkByName(distDir, bundle)
                if (chunk) {
                    await mixinChunksForIIFE(plugin, chunk, bundle)
                }
            }
        }
    }
}
