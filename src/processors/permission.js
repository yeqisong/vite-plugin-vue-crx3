import permissionFuncs from '../manifest/permission'
export class PermissionProcessor {
    /**
     * 获取代码中使用到的chrome api
     * @param {*} code
     * @param {*} id
     * @returns
     */
    resolveCodePermission (plugin, chunks, manifest) {
        // 分析代码片段中使用到的api涉及的权限
        const perms = [...Object.values(chunks).reduce((st, { code }) =>
            Object.entries(permissionFuncs)
                .filter(([, func]) => func(code))
                .map(([key]) => key)
                .reduce((s, k) => s.add(k), st)
        , new Set())].map(p => p.split('_').slice(-1)[0])
        // 更新manifest中权限的设置
        const np = [...new Set([...(manifest.permissions || []), ...perms])]
        if (np.length > 0) {
            manifest.permissions = np
        } else {
            delete manifest.permissions
        }
    }
}
