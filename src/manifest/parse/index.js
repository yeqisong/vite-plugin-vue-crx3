import get from 'lodash.get'
import diff from 'lodash.difference'
import {hasMagic, sync as globsync} from 'glob'
import { join } from 'path'
import { isString } from '../../util/functions'
/**
 * 解析maninfest内容获取其中配置的静态资源
 * @param {*} manifest manifest配置内容
 * @param {*} srcDir src根目录
 * @returns 静态资源对象
 */
export const deriveFiles = (manifest, srcDir) => {
    const validate = ary => [...new Set(ary.filter(f => isString(f)))].map(x => join(srcDir, x))
    // 从web_accessible_resources获取静态资源，其配置一般如下格式
    // "web_accessible_resources": [
    //     {
    //         "resources": [ "test1.png", "test2.png" ],
    //         "matches": [ "https://web-accessible-resources-1.glitch.me/*" ]
    //     }, {
    //         "resources": [ "test3.png", "test4.png" ],
    //         "matches": [ "https://web-accessible-resources-2.glitch.me/*" ],
    //         "use_dynamic_url": true
    //     }
    // ]
    // 循环获取web_accessible_resources中的静态资源，在打包时作为多文件打包的入口之一
    const web_accessible_resources = get(manifest, 'web_accessible_resources', []).reduce(
        (res_path, ress) => {
            return ress.resources.reduce(
                (farr, f) => {
                    // f中存在magic变量（匹配符）
                    if (hasMagic(f)) {
                        // 获取匹配的全部静态资源
                        const files = globsync(f, { cwd: srcDir })
                        return [...farr, ...files.map(x => x.replace(srcDir, ''))]
                    } else { // 如果没有匹配符，则把数组中文件路径全部获取
                        return [...farr, f]
                    }
                },
                res_path
            )
        },
        []
    )
    // js资源，来自web_accessible_resources(其中的js\ts\jsx\tsx文件)、backrgound、content-script(数组解析出来), 并且这些js资源需要打包为iife模式
    // content_scripts形式：
    // "content_scripts": [
    //     {
    //         "matches": ["http://*.nytimes.com/*"],
    //         "exclude_matches": ["*://*/*business*"],
    //         "js": ["contentScript.js"],
    //         "css": ["myStyles.css"],
    //     }
    // ],
    const js = [
        ...web_accessible_resources.filter(f => /\.[jt]sx?$/.test(f)),
        get(manifest, 'background.service_worker'),
        ...get(manifest, 'content_scripts', []).reduce(
            (fes, { js = [] }) => [...fes, ...js], []
        )
    ]
    // css资源， 来自web_accessible_resources、content_scripts
    const css = [
        ...web_accessible_resources.filter(f => f.endsWith('.css')),
        get(manifest, 'content_scripts', []).reduce(
            (ces, { css = [] }) => [...ces, ...css], []
        )
    ]
    // html资源，来自：
    // web_accessible_resources
    // options_page，配置形式 "options_page": "options.html",
    // options_ui.page，配置形式
    // "options_ui": {
    //     "chrome_style": true,
    //     "page": "options.html"
    // },
    // devtools_page，配置形式 "devtools_page": "devtools.html",
    // action.default_popup，配置形式
    // "action": {
    //     "default_title": "__MSG_actionTitle__",
    //     "default_popup": "popup.html",
    //     "default_icon": {
    //         "16": "/images/action16.png",
    //         "32": "/images/action32.png",
    //         "48": "/images/action48.png",
    //         "64": "/images/action64.png",
    //         "128": "/images/action128.png"
    //     }
    // },
    // chrome_url_overrides，配置形式
    // "chrome_url_overrides" : {
    //     "pageToOverride（bookmarks|history|newtab）": "myPage.html"
    // },
    const html = [
        ...web_accessible_resources.filter(f => /\.html?$/.test(f)),
        get(manifest, 'options_page'),
        get(manifest, 'options_ui.page'),
        get(manifest, 'devtools_page'),
        get(manifest, 'action.default_popup'),
        ...Object.values(get(manifest, 'chrome_url_overrides', {}))
    ]
    // action icon图标，一般在web_accessible_resources、action.default_icons、icons中
    const actionIcons = (icons => {
        let ais = new Set()
        if (typeof icons === 'string') {
            ais.add(icons)
        } else {
            Object.values(icons).forEach(x => ais.add(x))
        }
        return ais
    })(get(manifest, 'action.default_icon', {}))
    const img = [
        ...actionIcons,
        ...web_accessible_resources.filter(f =>
            /\.(jpe?g|png|svg|tiff?|gif|webp|bmp|ico)$/i.test(f)
        ),
        ...Object.values(get(manifest, 'icons', {}))
    ]
    // 剩余的静态文件放在other中
    const others = diff(web_accessible_resources, css, js, html, img)
    return {
        css   : validate(css),
        js    : validate(js),
        html  : validate(html), // html可能不在src目录下
        img   : validate(img),
        others: validate(others)
    }
}
