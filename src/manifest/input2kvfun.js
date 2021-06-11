import { relative } from 'path'
/**
 * 将input数组中的文件转为key-value格式的函数
 * @param {*} srcDir 根目录
 * @returns reduce函数
 */
export const input2kuFunction = srcDir => {
    if (srcDir === null || typeof srcDir === 'undefined') {
        // This would be a config error, so should throw
        throw new Error('[vite-plugin-vue-crx3 error] srcDir is null or undefined')
    }
    return (inputkv, file) => {
        // vite.config.js中input.name一般为输出目录的相对路径和文件名
        let name = relative(srcDir, file).split('.').slice(0, 1).join('.')
        // 如果那么已经出现过，抛出错误，name不能重复
        if (name in inputkv) {
            throw new Error(
                `Script files with different extensions should not share names:\n\n"${file}"\nwill overwrite\n"${inputkv[name]}"`
            )
        }
        // 返回当前file的kv到kv结果中
        return { ...inputkv, [name]: file }
    }
}
