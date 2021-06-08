/**
 * chrome权限正则定义
 */
// 简单权限正则表达式
const simplePermRegx = name => {
    let n = name.split('.')
    let r = ''
    if (n.length < 2) {
        r = n
    } else {
        r = n.splice(1).reduce((s, c) => { s += `[\\s\\n]*\\.[\\s\\n]*${c}`; return s }, n)
    }
    return new RegExp(`chrome[\\s\\n]*\\.[\\s\\n]*${r}`)
}
// 生成正则验证函数
const simplePermRegxFac = name => str => simplePermRegx(name).test(str)
// 全部简单权限列表
const simplePermList = [
    'alarms',
    'bookmarks',
    'browingData',
    'certificateProvider',
    'contentSettings',
    'contextMenus',
    'cookies',
    'debugger',
    'declarativeContent',
    'declarativeNetRequest',
    'declarativeWebRequest',
    'desktopCapture',
    'documentScan',
    'downloads',
    'enterprise.deviceAttributes',
    'enterprise.hardwarePlatform',
    'enterprise.networkingAttributes',
    'enterprise.platformKeys',
    'experimental',
    'fileBrowserHandler',
    'fileSystemProvider',
    'fontSettings',
    'gcm',
    'geolocation',
    'history',
    'identity',
    'idle',
    'loginState',
    'management',
    'nativeMessaging',
    'notifications',
    'pageCapture',
    'platformKeys',
    'power',
    'printerProvider',
    'printing',
    'printingMetrics',
    'privacy',
    'processes',
    'proxy',
    'scripting',
    'search',
    'sessions',
    'signedInDevices',
    'storage',
    'system.cpu',
    'system.display',
    'system.memory',
    'system.storage',
    'tabCapture',
    'tabGroups',
    'topSites',
    'tts',
    'ttsEngine',
    'vpnProvider',
    'wallpaper',
    'webNavigation',
    'webRequest'
]
// 生成简单权限的导出函数
const simplePermFunc = (ps => ps.reduce((po, p) => {
    po['per_' + p] = simplePermRegxFac(p)
    return po
}, {}))(simplePermList)
// 复杂权限验证函数
const multiplePermFunc = {
    per_clipboardRead : str => /document[\s\n]*\.[\s\n]*execCommand[\s\n]*\([\s\n]*[\'\"]{1}[\s\n]*paste[\s\n]*[\'\"]{1}[\s\n]*\)/.test(str),
    per_clipboardWrite: str => /document[\s\n]*\.[\s\n]*execCommand[\s\n]*\([\s\n]*[\'\"]{1}[\s\n]*(copy||cut)[\s\n]*[\'\"]{1}[\s\n]*\)/.test(str)
}
// todo ...
// tabs、activeTab、webRequestBlocking、background
// 导出全部权限匹配函数
export default { ...simplePermFunc, ...multiplePermFunc }
