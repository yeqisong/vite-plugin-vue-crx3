/**
 * vite2+vue3开发chrome extension (manifest v3)
 * 支持：npm 7+ || nodejs v14.15+ || vite v2.3.4
 * npm run watch (vite build --watch) 启用拓展热重载，即文件修改后，拓展自动更新&页面自动刷新，目录会多2个支持热重载的文件
 * npm run build 打包拓展文件，不会生成热重载所需的支持文件
 * 参考实现：https://github.com/StarkShang/vite-plugin-chrome-extension
 */
import chalk from 'chalk'
import { resolve } from 'path'
import { ManifestProcessor } from './processors/manifest'
import { clearEmptyDir } from './util/dir'
import crtRealod from './reload'
import { entryDef } from './entry'
export default options => {
    // 如果不是watch模式，不启用该插件
    if (process.env.npm_lifecycle_event !== 'watch' && process.env.npm_lifecycle_event !== 'build') {
        console.warn('\n', chalk.bold.yellow('vite-plugin-vue-crtv3 warn:'), chalk.yellow('请使用npm run watch 或 npm run build 启用vite-plugin-vue-crtv3，支持chrome extentsion 开发！'))
        return false
    }
    // vite配置文件
    let viteConfig
    // 插件配置文件
    const pluginOption = { ...options }
    // manifest内容
    let manifest
    // manifest处理程序实例，处理并缓存manifest信息
    const manifestProcessor = new ManifestProcessor(pluginOption)
    return [{
        name: 'vite-plugin-vue-crtv3',
        configResolved (config) {
            viteConfig = config
        },
        async options (options) {
            // 根据vite.config获取manifest内容解析出inputs，并保存到示例。manifest不更新，实例缓存不变
            if (!manifestProcessor.manifest) {
                // 获取manifest内容
                manifest = manifestProcessor.load(options, viteConfig)
                // 解析manifest内容得到input配置对象，入参为用户剩余input配置（非manifest）
                options.input = manifestProcessor.resolveInput(options.input)
            } else {
                options.input = manifestProcessor.inputs
            }
            console.log('\n', 'vite-plugin-vue-crtv3 tranfer( get entry files ):', '\n', chalk.blue(JSON.stringify(options.input, null, 4)), '\n')
            return options
        },
        async buildStart () {
            manifestProcessor.addWatchFile(this)
            // 输出静态资源css\img\other
            await manifestProcessor.emitFiles(this)
            return null
        },
        transform (code, id, ssr) {
            return manifestProcessor.transform(this, code, id, ssr)
        },
        watchChange (id) {
            manifestProcessor.clearCacheById(id)
        },
        outputOptions (options) {
            return {
                ...options,
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
                entryFileNames: '[name].js'
            }
        },
        async generateBundle (options, bundle, isWrite) {
            // 输出入口js（iife）
            await manifestProcessor.generateBundle(this, bundle)
        },
        async closeBundle () {
            // 移动入口html
            await manifestProcessor.moveEntryHtml()
            // 清理空目录
            clearEmptyDir(resolve(viteConfig.build.outDir || 'dist'))
        }
    }, crtRealod({
        entry_bg      : entryDef.background.dist + '.js',
        entry_manifest: entryDef.manifest.dist
    })]
}
