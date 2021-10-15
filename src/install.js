const https = require('https')
const filepath = require('path');
const tc = require('@actions/tool-cache');
const core = require("@actions/core");
const os = require('os');

function getVersion(version) {
    let path = ''
    if (version == "latest") {
        path = '/repos/checkmarx/kics/releases/latest'
    } else {
        path = '/repos/checkmarx/kics/releases/tags/' + version
    }
    const options = {
        hostname: 'api.github.com',
        port: 443,
        path: path,
        headers: {
            'User-Agent': 'node.js'
        },
        method: 'GET'
    }
    return new Promise((resolve, reject) => {
        const req = https.get(options, (resp) => {
            console.log(`${options.method} https://${options.hostname}${options.path} ${resp.statusCode}`)
            let rawData = '';
            resp.on('data', (d) => {
                rawData += d;
            });
            resp.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    resolve(parsedData);
                } catch (e) {
                    reject(e);
                }
            });
        })

        req.on('error', (error) => {
            reject(error);
        })
    })
}

function getReleaseInfo(release) {
    const assets = release.assets || [];
    const os = process.platform;
    const arch = process.arch;
    let targetAsset;
    switch (os) {
        case 'darwin':
            targetAsset = assets.filter((asset) => asset.name.indexOf('darwin') !== -1 && asset.name.indexOf(arch) !== -1)[0];
            break;
        case 'linux':
            targetAsset = assets.filter((asset) => asset.name.indexOf('linux') !== -1 && asset.name.indexOf(arch) !== -1)[0];
            break;
        case 'win32':
            targetAsset = assets.filter((asset) => asset.name.indexOf('windows') !== -1 && asset.name.indexOf(arch) !== -1)[0];
            break;
        default:
            targetAsset = { size: 0, browser_download_url: '' };
    }
    return {
        binary: 'kics',
        size: targetAsset.size,
        browser_download_url: targetAsset.browser_download_url,
        version: release.tag_name,
        arch: arch
    };
}

async function installKICS(kicsVersion) {
    let release = {};
    if (!kicsVersion || kicsVersion == "latest") {
        release = await getVersion("latest");
    } else {
        release = await getVersion(kicsVersion);
    }
    const releaseInfo = getReleaseInfo(release)
    let kicsPath = tc.find(releaseInfo.binary, releaseInfo.version, releaseInfo.arch);
    if (!kicsPath) {
        core.info(`Downloading ${releaseInfo.binary} ${releaseInfo.version} ${releaseInfo.arch}`);
        const kicsDownloadPath = await tc.downloadTool(releaseInfo.browser_download_url);
        const kicsExtractedFolder = await tc.extractTar(kicsDownloadPath, filepath.join(os.homedir(), 'kics', releaseInfo.version));
        kicsPath = await tc.cacheDir(kicsExtractedFolder, 'kics', releaseInfo.version, releaseInfo.arch);
    }
    core.addPath(kicsPath);
}

module.exports = {
    installKICS
}