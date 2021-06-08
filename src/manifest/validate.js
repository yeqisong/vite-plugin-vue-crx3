export const validateManifest = manifest => {
    if (!manifest) { throw new Error('[validateManifest] Manifest cannot be empty') }
    return true
}
