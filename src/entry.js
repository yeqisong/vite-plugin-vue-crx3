/**
 * crt关键入口文件的位置定义，不论开发时放在什么目录，都强制转到根目录
 */
export const entryDef = {
    // manifest位置命名
    manifest: {
        dist: 'manifest.json'
    },
    // background.js的位置及命名
    background: {
        manifest: '',
        dist    : 'background'
    },
    // content[].js的位置及命名
    content: {
        manifest: [],
        dist    : [],
        dir     : 'content'
    }
}
