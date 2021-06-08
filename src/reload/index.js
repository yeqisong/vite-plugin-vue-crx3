import chalk from 'chalk'
import { bgCode, cntCode } from './tempcode'
import { reloadTimestampFile, reloadTimestampPlaceholder, reloadClientContentFile } from './CONTS'
import set from 'lodash.set'
import get from 'lodash.get'
import { outputJson } from 'fs-extra'
import { join } from 'path'
export default ({ entry_bg = 'baground.js', entry_manifest = 'manifest.js' }) => {
    // 如果不是npm run watch ，不执行该插件
    if (process.env.npm_lifecycle_event !== 'watch') {
        console.warn('\n', chalk.bold.yellow('vite-plugin-vue-crt-reload warn:'), chalk.yellow('请使用npm run watch 启用chrome extension开发热重载（修改文件后自动重载扩展、重载网页！）'))
        return false
    }
    // 缓存数据
    const cache = {}
    return {
        name: 'vite-plugin-vue-crt-reload',
        generateBundle ({ dir }, bundle, isWrite) {
            // 当前时间戳
            const cur_timestamp = new Date().getTime()
            // 替换bgCode中的定位符号(替换时间戳变量)
            const bg_code = bgCode.replace(reloadTimestampPlaceholder, cur_timestamp)
            // 缓存本次时间戳
            cache.timestamp = cur_timestamp
            cache.dir = dir
            // 在bundle中追加bg_code到background.js中
            bundle[entry_bg]['source'] = bundle[entry_bg]['source'] + bg_code + '\n'
            // 在bundle中输出client端自动刷新content_script
            this.emitFile({
                type    : 'asset',
                fileName: reloadClientContentFile,
                source  : cntCode
            })
            // 修改bundle中manifest.json的内容，添加相应的权限、添加client所需要的content_script
            const mftmp = JSON.parse(bundle[entry_manifest]['source'])
            // 将reloadClientContentFile文件添加到manifest的content_scripts中
            set(mftmp, 'content_scripts', (n => n.push({
                matches: ['<all_urls>'],
                js     : [reloadClientContentFile],
                run_at : 'document_idle'
            }) && n)(get(mftmp, 'content_scripts', [])))
            // 如果没有alarms权限，强制添加该权限
            set(mftmp, 'permissions', [...new Set((p => p.push('alarms') && p)(get(mftmp, 'permissions', [])))])
            bundle[entry_manifest]['source'] = JSON.stringify(mftmp, null, 4)
            console.log('\n------reload:generateBundle: add reload .js(${reloadClientContentFile})')
        },
        closeBundle () {
            // 生成时间戳文件(确保最后输出时间戳文件)
            outputJson(join(cache.dir || 'dist', reloadTimestampFile), { time: cache.timestamp })
            console.log(`\n------reload:closeBundle:crate ${reloadTimestampFile} file`)
            console.log('\n', chalk.green('vite-plugin-vue-crt-reload watch ...'), '(enter "control+c" or "ctrl+c" to exit watch mode)')
        }
    }
}
