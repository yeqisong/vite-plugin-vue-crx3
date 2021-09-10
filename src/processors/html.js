import { join, relative, normalize, resolve } from 'path'
import { slash1 } from '../util/functions'
import set from 'lodash.set'
import fs from 'fs-extra'
import { moveAndDelFile } from '../util/dir'
export class HtmlProcessor {
    // 统一入口文件的输出格式
    _distName (filename) {
        return slash1(filename).replace('/', '_')
    }
    /**
     * 修改manifest下全部html入口文件到outDir根目录
     * @param {*} outDir
     * @param {*} manifest
     */
    distDir (outDir, manifest) {
        ((...rest) => {
            for (const item of rest || []) {
                if (item[1]) {
                    // 入口扁平后的文件名为原路径名用_连接
                    // set(manifest, item[0], join(outDir, slash1(item[1]).split('/').slice(-1)[0]))
                    set(manifest, item[0], this._distName(normalize(slash1(item[1]))))
                }
            }
        })(
            ['action.default_popup', manifest.action?.default_popup],
            ['options', manifest.options_page],
            ['options_ui.page', manifest.options_ui?.page],
            ['devtools_page', manifest.devtools_page],
            ['chrome_url_overrides.bookmarks', manifest.chrome_url_overrides?.bookmarks],
            ['chrome_url_overrides.newtab', manifest.chrome_url_overrides?.newtab],
            ['chrome_url_overrides.history', manifest.chrome_url_overrides?.history]
        )
    }
    /**
     * 将指定htmls文件移动到指定位置
     * @param {*} htmls
     * @param {*} srcDir
     * @param {*} outDir
     */
    async moveHtml (htmls, srcDir, outDir) {
        const tsrc = slash1(srcDir).split('/').slice(-1)[0]
        // 遍历入口html文件
        for (let hfile of htmls || []) {
            // bundle生成的HTML文件路径，对其进行移动并删除
            let sourceFile = resolve(join(outDir, tsrc, relative(srcDir, hfile)))
            let targetFile = resolve(join(outDir, this._distName(normalize(relative(srcDir, hfile)))))
            await moveAndDelFile(sourceFile, targetFile)
        }
    }
}
