import fs from 'fs-extra'
import { join } from 'path'
import { isArray } from './functions'
/**
 * 检查文件是否存在且可操作
 * @param {*} sdir
 */
export const canDo = sdir => {
    try {
        fs.accessSync(sdir, fs.constants.R_OK | fs.constants.W_OK)
        return true
    } catch (err) {
        return false
    }
}
/**
 * 是否是目录
 */
export const isDir = sdir => {
    if (canDo(sdir)) {
        return fs.lstatSync(sdir).isDirectory()
    }
    return false
}
/**
 * 检查是非空目录，是则返回子文件和目录，否则删除
 * @param {*} sdir
 * @returns
 */
export const notEmptyDirWithClear = sdir => {
    if (!isDir(sdir)) { return false }
    // 如果是空目录，则直接删除
    try {
        const fls = fs.readdirSync(sdir)
        if (!fls.length) {
            fs.rmdirSync(sdir)
            return false
        }
        return fls
    } catch (e) {
        console.log(`[notEmptyDirWithClear] errors in ${sdir}:`)
        return false
        // throw new Error(`[notEmptyDirWithClear] errors in ${sdir}:`, e)
        // return false
    }
}
/**
 * 移动并移动后删除文件
 * @param {*} source
 * @param {*} target
 * @param {*} readOption
 * @param {*} writeOption
 * @returns promise
 */
export const moveAndDelFile = (source, target, readOption = {}, writeOption = {}) => new Promise((rsv, rsj) => {
    if (!canDo(source)) {
        rsj(false)
    }
    try {
        if (fs.existsSync(source)) {
            let rstrm = fs.createReadStream(source, readOption)
            let wstrm = fs.createWriteStream(target, writeOption)
            rstrm.pipe(wstrm)
            wstrm.on('close', () => {
                // 删除源文件
                fs.unlinkSync(source)
                rsv(true)
            })
        }
    } catch (error) {
        throw new Error(`[movehtml] errors in ${source}:`, error)
    }
})
/**
 * 指定路径，清除路径下的所有空目录，包含子文件夹
 * @param {*} sdir
 */
export const clearEmptyDir = sdir => {
    // 不是文件夹不处理
    if (!isDir(sdir)) { return false }
    // 遍历子文件和文件夹
    const checkDir = (dirs, dpDir = []) => {
        if (!isArray(dirs) || !dirs.length) { return dpDir }
        let nextDirs = []
        // 本层目录遍历
        for (let d of dirs) {
            // d是非空目录
            let cdirs = notEmptyDirWithClear(d)
            // 如果是空目录（下级无），则退出继续循环
            if (!cdirs) {
                continue
            }
            // 如果有子文件或目录，遍历分析
            for (let chd of cdirs) {
                // 组合完整路径
                let chd_path = join(d, chd)
                // 如果不是目录，则退出循环继续
                if (!isDir(chd_path)) {
                    continue
                }
                // 如果是空目录则删除子目录，否则保存到下级数组中
                if (notEmptyDirWithClear(chd_path)) {
                    nextDirs.push(chd_path)
                }
            }
        }
        // 递归check下一层的目录
        if (nextDirs.length) {
            dpDir.push(nextDirs)
            return checkDir(nextDirs, dpDir)
        } else {
            return dpDir
        }
    }
    // 向下遍历，删除最低层级的空目录，获得子树结构
    const dirTree = checkDir([sdir], [])
    // 从下向上遍历，删除空目录
    for (let dp of dirTree.reverse()) {
        // 遍历每层的目录
        for (let pdr of dp) {
            // 如果是空目录则删除
            notEmptyDirWithClear(pdr)
        }
    }
}
