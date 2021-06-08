import { isAsset, isChunk } from './functions'
/**
 * 从bundle中获取包含chunk的对象
 * @param {*} bundle
 * @returns
 */
export const getChunk = bundle => Object.keys(bundle).filter(k => isChunk(bundle[k])).reduce(
    (carr, c) => {
        carr[c] = bundle[c]
        return carr
    }, {}
)
/**
 * 从bundle中获取包含asset对象
 * @param {*} bundle
 * @returns
 */
export const getAssets = bundle => Object.keys(bundle).filter(k => isAsset(bundle[k])).reduce(
    (carr, c) => {
        carr[c] = bundle[c]
        return carr
    }, {}
)
