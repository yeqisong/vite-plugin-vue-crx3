import { reloadTimestampFile, reloadTimestampPlaceholder } from './CONTS'
export const bgCode =  `
/** *************************************************reload bg.js start( "npm run build" should not create this code )*************************************************************/
// 插件自动重载方法
// 每次生成bg代码时，重置crt3_reload_timestamp变量 和 crt3_reload_timestamp.json中time变量的值相等
// bacground.js获取本地目录的crt3_timestamp.json文件并解析time，如果时间戳不相等，则表示插件包文件有变化，自动重载插件
let crt3_reload_timestamp_heart = 1
const crt3_reload_timestamp = ${reloadTimestampPlaceholder}
async function crt3_reload_interval(){
    let rstime = await fetch('${reloadTimestampFile}').then(f => f.json()).then(rst => {
        if(rst.time){
            return rst.time
        }
        return 0
    }).catch(error => {
        // 如果文件未获取到，默认rst.time为undefined
        return 0
    })
    // console.log('rstime----:',rstime)
    // 如果没有取到值，一般是刚更新文件获取不到，这个时候不能强制reload，顾让它复制相等通过本次轮询
    if(!rstime){
        rstime = crt3_reload_timestamp
    }
    // console.log('crt3_reload_timestamp heart....',crt3_reload_timestamp_heart, crt3_reload_timestamp, rstime)
    crt3_reload_timestamp_heart++
    // 时间戳对比，不同则重新加载
    if (crt3_reload_timestamp !== rstime) {
        // 延迟更新：时间戳文件创建在其它文件之前，可能出现重载插件时，文件不全，适当进行延迟重载
        chrome.alarms.clear('crt3_reload_interval_alarms')
        chrome.runtime.reload()
    }
}
chrome.runtime.onInstalled.addListener(()=>{
    chrome.alarms.create('crt3_reload_interval_alarms', {periodInMinutes:0.01})
})
chrome.alarms.onAlarm.addListener(alarms=>{
    if(alarms.name === 'crt3_reload_interval_alarms'){
        crt3_reload_interval();
        chrome.alarms.create('crt3_reload_interval_alarms', {periodInMinutes:0.01})
    }
})
/** *************************************************reload bg.js end*************************************************************/
`
export const cntCode = `
/** *************************************************reload client.js start( "npm run build" should not create this code )*************************************************************/
// 客户端自动更新方法
// 客户端定时获取manifest，如果无法获取到则表示插件已经重载，客户端页面自动刷新，以启用最新插件
let crt3_reload_client_heart = 1
const crt3_clien_refresh_id = setInterval(() => {
    // console.log('crt3_reload_client heart....',crt3_reload_client_heart)
    crt3_reload_client_heart++
    try {
        chrome.runtime.getManifest()
    } catch (error) {
        if (error.message === 'Extension context invalidated.') {
            setTimeout(() => {
                location.reload()
            }, 500)
            clearInterval(crt3_clien_refresh_id)
        }
    }
}, 1000)
/** *************************************************reload client.js end*************************************************************/
`
