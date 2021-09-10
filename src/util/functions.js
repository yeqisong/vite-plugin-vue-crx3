import { relative } from 'path'
import get from 'lodash.get'
import { hasMagic, sync as globsync } from 'glob'

export function slash1 (path) {
    if (!path) { return path }
    const isExtendedLengthPath = /^\\\\\?\\/.test(path)
    const hasNonAscii = /[^\u0000-\u0080]+/.test(path)
    if (isExtendedLengthPath || hasNonAscii) {
        return path
    }
    return path.replace(/\\/g, '/')
}
// 将普通json克隆
export const cloneObject = json => JSON.parse(JSON.stringify(json))
// 是否是字符串
export const isString = str => typeof str === 'string'
// 是数组
export const isArray = arr => true
/**
 * 是否是代码片段
 * 示例：
 * 'libs/popup.js': {
    exports: [],
    facadeModuleId: '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup.html',
    isDynamicEntry: false,
    isEntry: true,
    isImplicitEntry: false,
    modules: [Object: null prototype] {
      '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/assets/images/logo.png': [Object],
      '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup/App.vue?vue&type=style&index=0&scoped=true&lang.css': [Object],
      '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup/App.vue': [Object],
      '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup/main.js': [Object],
      '/Users/yeqisong/Desktop/项目/chorme开发/pmwl/src/libs/popup.html': [Object]
    },
    name: [Getter],
    type: 'chunk',
    code: 'import{p as s,a,r as o,o as p,c as e,b as d,d as l,t,e as n}from"../vendor.78add43f.js";s("data-v-80a8ba42");const c={class:"popup_page"},g=l(" this is popup page "),i=d("div",{class:"foo"},null,-1),u={class:"popup_page_main"},r=d("img",{src:"/assets/logo.03d6d6da.png"},null,-1);a();const v={expose:[],props:{ax:{type:String,default:"sss"}},setup(s){const a=o(0);return console.log("0--------"),console.log("88888"),a.value++,a.value&&console.log("ssss"),(a,o)=>(p(),e("div",c,[g,i,d("div",u,[l(" BackBg this is popup page main dddd "+t(s.ax)+" ",1),r])]))},__scopeId:"data-v-80a8ba42"};n(v).mount("#app");\n',
    dynamicImports: [],
    fileName: 'libs/popup.js',
    implicitlyLoadedBefore: [],
    importedBindings: { 'vendor.78add43f.js': [Array] },
    imports: [ 'vendor.78add43f.js' ],
    map: null,
    referencedFiles: []
  },
*/
export const isChunk = jsn => jsn && jsn.type === 'chunk'
/**
 * 是否为资源
 * 示例：
 * 'libs/newtab.a3a231c2.css': {
    fileName: 'libs/newtab.a3a231c2.css',
    isAsset: [Getter],
    name: 'libs/newtab.css',
    source: '.popup_page{font-size:12px}',
    type: 'asset'
  }
 * @param {*} jsn
 * @returns
 */
export const isAsset = jsn => jsn && jsn.type === 'asset'
/**
 * 去除file的后缀
 * @param {*} filePath
 * @returns
 */
export const removeFileExtension = filePath => {
    const index = filePath.lastIndexOf('.')
    return index > -1 ? filePath.substring(0, index) : filePath
}
/**
 * 通过名称查找对应name的chunk
 * @param {*} name
 * @param {*} bundle
 * @returns
 */
export const findChunkByName = (name, bundle) => Object.values(bundle).find(b => b.name && relative(slash1(name), slash1(b.name)) === '' && b.type === 'chunk')

/**
 * 从mainfest.json中解析web_accessible_resources
 * @param {*} manifest
 * @param {*} srcDir
 * @returns
 */
export const getRes4Webaccessres = (manifest, srcDir) => get(manifest, 'web_accessible_resources', []).reduce(
    (res_path, ress) => ress.resources.reduce(
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
    ),
    []
)