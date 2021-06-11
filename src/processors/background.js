import { relative, parse, resolve, join } from 'path'
import { findChunkByName, removeFileExtension, slash1 } from '../util/functions'
import { mixinChunksForIIFE } from './mixin'
import { entryDef } from '../entry'
import { canDo } from '../util/dir'
import { readFileSync } from 'fs'
import { uniqueId } from 'lodash'
import get from 'lodash.get'
const dynamicImportAssetRex = /(?<=chrome.scripting.insertCSS\()[\s\S]*?(?=\))/gm
const dynamicImportScriptRex = /(?<=chrome.scripting.executeScript\()[\s\S]*?(?=\))/gm
export class BackgroundProcessor {
    dyJsCache = {}
    dyAssetCache = {}
    constructor(options) {
        this.options = options
        this.dyJsCache = {}
        this.dyAssetCache = {}
    }
    /**
     * 强制修改background的入口位置
     * @param {*} inputs
     * @param {*} manifest
     */
    distDir (inputs, manifest) {
        if (manifest.background.service_worker) {
            entryDef.background.manifest = manifest.background.service_worker
            const bdir = removeFileExtension(manifest.background.service_worker)
            // 找到background的kv并进行替换和删除
            const tkey = Object.keys(inputs).find(k => relative(slash1(k), slash1(bdir)) === '')
            if (tkey) {
                inputs[entryDef.background.dist] = inputs[tkey]
                delete inputs[tkey]
            }
        }
    }
    /**
     * 处理background.js的代码，转为iife格式
     * @param {*} plugin
     * @param {*} bundle
     * @param {*} manifest
     */
    async generateBundle (plugin, bundle, manifest) {
        // console.log('---:', manifest.background.service_worker)
        if (manifest.background.service_worker) {
            const distDir = entryDef.background.dist
            // 从bundle中找到background对应的chunk
            const chunk = findChunkByName(distDir || removeFileExtension(manifest.background.service_worker), bundle)
            if (chunk) {
                // chrome91新特性支持es模块，用户如果设置type:module，则不进行iife处理
                if (get(manifest, 'background.type', '') === 'module') {
                    manifest.background.service_worker = chunk.fileName
                } else {
                    // 生成的iife文件路径设置为service_worker配置
                    manifest.background.service_worker = slash1(await mixinChunksForIIFE(plugin, chunk, bundle))
                }
            }
        }
    }
    /**
     * 解析代码中executeScript的js文件，并统一输出为content_scripts文件
     * @param {*} plugin
     * @param {*} code
     * @returns
     */
    resolveDynamicImports (plugin, code, id) {
        if (!this.options.srcDir) {
            throw new Error('[vite-plugin-vue-crx3 error] BackgroundProcesser: options.srcDir is not initialized')
        }
        // 动态导入的js文件
        const dynamicImports = []
        const idfile = parse(id)
        let updatedCode = code.replace(dynamicImportScriptRex,
            match => match.replace(/(?<=(files\s*:\s*\[)?[\"\'])[\s\S]*?(?=\]?[\"\'])/gm, fileStr => {
                fileStr = fileStr.replace(/[\"\']/g, '').trim()
                const filePath = resolve(idfile.dir, fileStr)
                const file = parse(filePath)
                // 添加代码判断，将其全部放在content_scripts文件夹下
                if (canDo(filePath)) {
                    let fne
                    // 检查缓存中是否已经处理过该路径，如果是，则直接返回上次文件名（避免同一个js文件生成多个文件）
                    if (this.dyJsCache[filePath]) {
                        // dynamicImports.push(this.dyJsCache[filePath].refId)
                        fne = this.dyJsCache[filePath].fne
                    } else {
                        fne = join(entryDef.content.dir, file.name + '.' + uniqueId() + '.js')
                    }
                    // 该文件生成chunk
                    if (!(this.dyJsCache[filePath] && this.dyJsCache[filePath]?.refId && plugin.getFileName(this.dyJsCache[filePath].refId))) {
                    // if (!(this.dyJsCache[filePath] && this.dyJsCache[filePath]?.refId)) {
                        const refId = plugin.emitFile({
                            id      : filePath,
                            fileName: fne,
                            type    : 'chunk'
                        })
                        dynamicImports.push(refId)
                        // 缓存该处理记录
                        this.dyJsCache[filePath] = {
                            fne,
                            refId
                        }
                    }
                    return fne
                } else {
                    throw new Error(`[vite-plugin-vue-crx3 error] "${filePath}" from "chrome.scripting.executeScript" in background.js do not exist. it is must in the extension's root directory. `)
                    // return fileStr
                }
            })
        )
        // 动态导入的css等资源文件
        const dynamicImportsCss = []
        updatedCode = updatedCode.replace(dynamicImportAssetRex,
            match => match.replace(/(?<=(files\s*:\s*\[)?[\"\'])[\s\S]*?(?=\]?[\"\'])/gm, fileStr => {
                fileStr = fileStr.replace(/[\"\']/g, '').trim()
                const filePath = resolve(idfile.dir, fileStr)
                const file = parse(filePath)
                // const filePath = resolve(this.options.srcDir, m);
                if (canDo(filePath)) {
                    let fne
                    // 检查缓存读取缓存
                    if (this.dyAssetCache[filePath]) {
                        fne = this.dyAssetCache[filePath]
                    } else {
                        fne = join(entryDef.content.dir, file.name + '.' + uniqueId() + file.ext)
                    }
                    if (!this.dyAssetCache[filePath]) {
                        plugin.emitFile({
                            type    : 'asset',
                            fileName: fne,
                            source  : readFileSync(filePath)
                        })
                        dynamicImportsCss.push(join(filePath))
                        // 缓存该处理记录
                        this.dyAssetCache[filePath] = fne
                    }
                    return fne
                } else {
                    throw new Error(`[vite-plugin-vue-crx3 error] "${filePath}" from "chrome.scripting.insetCSS" in background.js do not exist. it is must in the extension's root directory. `)
                    // return fileStr
                }
            })
        )
        return { code: updatedCode, imports: dynamicImports, importCss: dynamicImportsCss }
    }
    clearCache () {
        this.dyJsCache = {}
        this.dyAssetCache = {}
    }
}
