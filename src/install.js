const https = require('https')
const filepath = require('path');
const tc = require('@actions/tool-cache');
//const releaseDownloader = require('@fohlen/github-release-downloader');
const os = require('os');
//const decompress = require('decompress');
//const decompressTargz = require('decompress-targz');

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
    return { size: targetAsset.size, browser_download_url: targetAsset.browser_download_url, version: targetAsset.name };
}

// async function downloadReleaseFile(releaseAsset) {
//     const dest = os.homedir();
//     const releaseURL = releaseAsset.browser_download_url;

//     console.log("Downloading", releaseURL);
//     const baseName = releaseURL.substr(releaseURL.lastIndexOf("/") + 1);
//     return releaseDownloader.downloadAsset(releaseURL, baseName, dest, () => {
//         process.stdout.write(".");
//     });
// }

// function decompressRelease(path) {
//     const dest = os.homedir();
//     return decompress(path, filepath.join(dest, 'kics'), {
//         plugins: [
//             decompressTargz()
//         ]
//     });
// }

// function getExecutableName() {
//     const os = process.platform;
//     switch (os) {
//         case 'darwin':
//         case 'linux':
//             return 'kics';
//         case 'win32':
//             return 'kics.exe';
//         default:
//             return 'kics';
//     }
// }

async function installKICS(kicsVersion) {
    let release = {};
    if (!kicsVersion || kicsVersion == "latest") {
        release = await getVersion("latest");
    } else {
        release = await getVersion(kicsVersion);
    }
    const releaseInfo = getReleaseInfo(release)

    const kicsDownloadPath = await tc.downloadTool(releaseInfo.browser_download_url);
    const kicsExtractedFolder = await tc.extractTar(kicsDownloadPath, filepath.join(os.homedir(), 'kics', releaseInfo.version));
    const cachedPath = await tc.cacheDir(kicsExtractedFolder, 'kics', releaseInfo.version);
    core.addPath(cachedPath);

    // const releasePath = await downloadReleaseFile(releaseAsset, "./")
    // console.log('\nDownloaded KICS release', releasePath);
    // const files = await decompressRelease(releasePath);
    // console.log('\nDecompressed KICS release', files.map(f => f.path));

    // const kicsPath = filepath.join(os.homedir(), 'kics', getExecutableName());
    // console.log('\nInstalling KICS to', kicsPath);
    return kicsPath;
}

module.exports = {
    installKICS
}