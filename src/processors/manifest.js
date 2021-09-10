import chalk from 'chalk'
import memoize from 'lodash.memoize'
import fs from 'fs-extra'
import { basename, dirname, relative } from 'path'
import { cosmiconfigSync } from 'cosmiconfig'
import { cloneObject } from '../util/functions'
import { BackgroundProcessor } from './background'
import { ContentScriptProcessor } from './content'
import { PermissionProcessor } from './permission'
import { WebresProcessor } from './webres'
import { deriveFiles } from '../manifest/parse'
import { input2kuFunction } from '../manifest/input2kvfun'
import { getAssets, getChunk } from '../util/bundle'
import { entryDef } from '../entry'
import { validateManifest } from '../manifest/validate'
import { HtmlProcessor } from './html'
import { canDo } from '../util/dir'
import { uniqueId } from 'lodash'
// 同步读取manifest配置文件
export const explorerSync = cosmiconfigSync('manifest', {
    cache: false
})
export class ManifestProcessor {
    // 入口配置
    inputs
    // 缓存属性
    cache = {
        assetChanged               : false,
        html                       : [],
        assets                     : [],
        iife                       : [],
        // 缓存数组类input（含用户自定义）
        input                      : [],
        // option.input.manifest路径(数组形式)删除manifest路径后剩余的配置
        inputAry                   : [],
        // option.input.manifest路径(对象形式)删除manifest路径后剩余的配置
        inputObj                   : {},
        dynamicImportContentScripts: [],
        // dynamicImportContentCss    : [],
        permsHash                  : '',
        permissions                : [],
        srcDir                     : null,
        // 不存在的资源
        notfiles                   : {},
        notfilea                   : []
    }
    // manifest信息json
    manifest
    contentScriptProcessor = null
    permissionProcessor = null
    backgroundProcessor = null
    // 构造函数
    constructor(options) {
        this.options = options
        this.contentScriptProcessor = new ContentScriptProcessor()
        this.permissionProcessor = new PermissionProcessor()
        this.backgroundProcessor = new BackgroundProcessor(options)
        this.htmlProcessor = new HtmlProcessor()
        this.webresProcessor = new WebresProcessor()
    }
    /**
     * 根据vite.config配置加载manifest文件并解析
     * @param {*} option vite.config.js配置
     * @returns manifest配置信息
     */
    load (option, viteCfg) {
        // 获取manifest路径
        const manifestPath = this.resolveManifestPath(option)
        // 获取manifest.json内容
        const manifestContent = explorerSync.load(manifestPath)
        // 验证manifest内容
        this._validateManifestContent(manifestContent)
        // 合并用户自定义的配置
        this.manifest = this._applyExternalManifestConfiguration(manifestContent)
        // 缓存manifest信息
        this.options.manifestPath = manifestContent.filepath
        this.options.srcDir = dirname(this.options.manifestPath)
        this.options.outDir = viteCfg.build.outDir || 'dist'
        return this.manifest
    }
    /**
     * 解析获取maninfest文件的路径
     * @param {*} option vite.config.js的配置文件
     * @returns maninfest的路径
     */
    resolveManifestPath (option) {
        // 如果option中没有input属性，抛出错误
        if (!option.input) {
            console.log(chalk.red('vite.config.js/bulid.rollupOptions.input is must'))
            throw new Error('vite.config.js/bulid/input is must')
        }
        let manifestPath = ''
        // 如果input是数组形式，查找其中是否包含manifest.json文件
        if (Array.isArray(option.input)) {
            const manifestAtIndex = option.input.findIndex(i => basename(i) === 'manifest.json')
            // 如果包含manifest.json文件，则该位置的数组元素为mainfest路径
            if (manifestAtIndex > -1) {
                // 作为路径结果返回
                manifestPath = option.input[manifestAtIndex]
                // 剩余配置保存到缓存中，并在input中删除该manifest文件
                this.cache.inputAry = option.input.slice(manifestAtIndex, 1)
            } else { // 如果不包含，抛出错误，无法解析出manifest.json信息
                console.log(chalk.red("vite.config.js/build.rollupOptions.input array must contain a Chrome extension manifest with filename 'manifest.json'."))
                throw new Error("vite.config.js/build.rollupOptions.input array must contain a Chrome extension manifest with filename 'manifest.json'.")
            }
        } else if (typeof option.input === 'object') { // 如果option.input以json形式配置，查找manifest的key
            if (option.input.manifest) {
                // 获取到manifest路径文件
                manifestPath = option.input.manifest
                // 从配置中删除manifest配置
                delete option.input['manifest']
                // 剩余配置保存在缓存中
                this.cache.inputObj = cloneObject(option.input)
            } else {
                console.log(chalk.red('vite.config.js/build.rollupOptions.input object must contain a Chrome extension manifest with Key manifest.'))
                throw new Error('vite.config.js/build.rollupOptions.input object must contain a Chrome extension manifest with Key manifest.')
            }
        } else { // input字符串就是mani.json
            manifestPath = option.input
            delete option.input
        }
        // 判断manifest.json是正确的文件名和后缀名
        if (basename(manifestPath) !== 'manifest.json') {
            throw new Error("[vite-plugin-vue-crx3 error] Input for a Chrome extension manifest must have filename 'manifest.json'.(In vite.config.js/build.rollupOptions.input)")
        }
        return manifestPath
    }
    /**
     * 解析资源，处理路径不存在的资源
     * @param {*} source 
     * @returns 
     */
    resolveId (source) {
        if (!canDo(source)) {
            let uuid = uniqueId()
            this.cache.notfilea.push(`filenotfound${uuid}`)
            this.cache.notfiles[`filenotfound${uuid}`] = source
            return `filenotfound${uuid}`
        }
        return null
    }
    /**
     * 处理路径不存在的资源
     * @param {*} id 
     * @returns 
     */
    loadSource (id) {
        if (this.cache.notfilea.indexOf(id)>-1) {
            console.error('\n', chalk.yellow('[vite-plugin-vue-crx3 error] file not found：'), chalk.red(`${this.cache.notfiles[id]}`))
            throw new Error(`${this.cache.notfiles[id]} : file not found!`)
        } else {
            return null
        }
    }
    /**
     * 解析入口文件配置并返回
     * @param {*} input 除了manifest.json入口外的其它入口
     * @returns {} input入口配置
     */
    resolveInput (input) {
        // 如果不存在manifest或者没有manifest路径
        if (!this.manifest || !this.options.srcDir) {
            throw new Error('[vite-plugin-vue-crx3 error] manifest or options.srcDir not initialized')
        }
        // 从manifest中获取全部静态资源定义
        const { js, html, css, img, others } = deriveFiles(
            this.manifest,
            this.options.srcDir
        )
        // 入口静态资源，包含js、html文件，合并用户自定义input（数组类型）
        this.cache.input = [...this.cache.inputAry, ...js, ...html]
        // assets类资源
        this.cache.assets = [...new Set([...css, ...img, ...others])]
        // 入口配置，数组转为json（key:value形式配置）格式，key中包含输出路径，合并用户自定义input（对象类型）
        // {
        //      'libs/background/main': '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/background/main.js',
        //      'libs/popup': '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup.html',
        //      'libs/newtab': '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/newtab.html'
        // }
        const inputs = this.cache.input.reduce(input2kuFunction(this.options.srcDir), this.cache.inputObj)
        // 修正核心入口文件位置(background)
        // {
        //      'background': '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/background/main.js',
        //      'libs/popup': '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup.html',
        //      'libs/newtab': '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/newtab.html'
        // }
        // 验证各文件路径是否可访问
        ;([...Object.values(inputs), ...this.cache.assets]).forEach(fl => {
            if (!canDo(fl)) {
                throw new Error(`[vite-plugin-vue-crx3 error] "${fl}" defined in the manifest.json does not exist!`)
            }
        })
        this.backgroundProcessor.distDir(inputs, this.manifest)
        // 修正核心入口文件位置(contentjs[])
        this.contentScriptProcessor.distDir(inputs, this.manifest)
        this.webresProcessor.distDir(inputs, this.manifest, this.options.srcDir)
        // 记录html入口文件
        this.cache.html = html
        // 修正核心入口文件位置（html)
        this.htmlProcessor.distDir(this.options.outDir, this.manifest)
        // 保存到实例上
        this.inputs = inputs
        return inputs
    }
    /**
     * 增加监听文件
     * @param {*} plugin rollup实例
     */
    addWatchFile (plugin) {
        // 将manifest.json增加到监听里
        plugin.addWatchFile(this.options.manifestPath)
        // // 将资源文件增加到监听
        this.cache.assets.forEach(ast => {
            plugin.addWatchFile(ast)
        })
    }
    /**
     * 文件变化时，清除对应缓存
     * @param {*} id
     */
    clearCacheById (id) {
        // manifest缓存更新
        if (id.endsWith('manifest.json')) {
            // 清除manifest文件缓存
            delete this.manifest
            this.cache.assetChanged = false
        } else {
            // 清除对应静态资源buffer缓存
            this.cache.assetChanged = this._readFileAsBuffer.cache.delete(id)
        }
    }
    async emitFiles (plugin) {
        // 读取全部资源
        const assets = await Promise.all(
            this.cache.assets.map(async frc => {
                let source = await this._readFileAsBuffer(frc)
                return {
                    type    : 'asset',
                    source,
                    fileName: relative(this.options.srcDir, frc)
                }
            })
        )
        // 添加到输出文件
        assets.forEach(ast => {
            plugin.emitFile(ast)
        })
    }
    /**
     * 处理bundle，尤其是对background.js和content.js的处理
     * @param {*} plugin rollup上下文实例
     * @param {*} bundle 输出的bundle对象
     */
    async generateBundle (plugin, bundle) {
        if (!this.manifest) { throw new Error('[manifest generate bundle] Manifest cannot be empty') }
        const chunks = getChunk(bundle)
        const assets = getAssets(bundle)
        // 分析代码中用到的chorme api，并对应更新manifest中的权限
        this.permissionProcessor.resolveCodePermission(plugin, chunks, this.manifest)
        // 处理manifest中content_scripts全部js
        await this.contentScriptProcessor.generateBundle(plugin, bundle, this.manifest)
        // 处理动态获取的content_scripts
        await this.contentScriptProcessor.generateBundleFromDynamicImports(plugin, bundle, this.cache.dynamicImportContentScripts)
        // 处理backround.js
        await this.backgroundProcessor.generateBundle(plugin, bundle, this.manifest)
        // 处理web_res中js全部处理为iife(主要针对于inject.js)
        await this.webresProcessor.generateBundle(plugin, bundle, this.manifest)
        // 生成manifest.json文件
        validateManifest(this.manifest)
        this._generateManifest(plugin, this.manifest)
        // console.log(assets)
    }
    /**
     * 移动html入口文件
     */
    async moveEntryHtml () {
        // 移动html入口文件
        await this.htmlProcessor.moveHtml(this.cache.html, this.options.srcDir, this.options.outDir)
        // 清理backrgound动态文件分析缓存
        this.backgroundProcessor.clearCache()
    }
    /**
     * 分析各代码片段中是否有动态加载的js和css资源，js需要转为iife模式
     * @param {*} plugin
     * @param {*} code
     * @param {*} id
     * @param {*} ssr
     * @returns
     */
    transform (plugin, code, id, ssr) {
        // 获取动态加载的资源
        const { code:updatedCode, imports, importCss } = this.backgroundProcessor.resolveDynamicImports(plugin, code, id)
        this.cache.dynamicImportContentScripts.push(...imports)
        // this.cache.dynamicImportContentCss.push(importCss)
        // 将asset资源追加到watch中
        if (importCss.length) {
            [...new Set(importCss)].forEach(c => {
                plugin.addWatchFile(c)
            })
        }
        return updatedCode
    }
    /**
     * 缓存函数，读取文件并缓存起来
     */
    _readFileAsBuffer = memoize(
        filePath => fs.readFile(filePath)
    )
    /**
     * 验证配置文件是否可用，不可用则抛出错误
     * @param {*} config manifest.json配置内容
     */
    _validateManifestContent (config) {
        // 配置文件为空
        if (config.isEmpty) {
            throw new Error(`[vite-plugin-vue-crx3 error] ${config.filepath} is an empty file.`)
        }
        // manifest中关键配置信息验证(options_page和options_ui不能同时设置)
        const { options_page, options_ui } = config.config
        if (
            options_page !== undefined &&
            options_ui !== undefined
        ) {
            throw new Error('[vite-plugin-vue-crx3 error] options_ui and options_page cannot both be defined in manifest.json.')
        }
    }
    /**
     * 合并用户自定义配置和manifest配置
     * @param {*} config manifest.json中的配置
     * @returns 返回最后的配置对象
     */
    _applyExternalManifestConfiguration(config) {
        if (typeof this.options.extendManifest === 'function') {
            return this.options.extendManifest(config.config)
        } else if (typeof this.options.extendManifest === 'object') {
            return {
                ...config.config,
                ...this.options.extendManifest
            }
        } else {
            return config.config
        }
    }
    /**
     * 生成manifest.json文件到dist中
     * @param {*} plugin
     * @param {*} manifest
     */
    _generateManifest(plugin, manifest) {
        const manifestJson = JSON.stringify(manifest, null, 4).replace(/\.[jt]sx?"/g, '.js"')
        // 添加manifest.json文件
        plugin.emitFile({
            type    : 'asset',
            fileName: entryDef.manifest.dist,
            source  : manifestJson
        })
    }
}
