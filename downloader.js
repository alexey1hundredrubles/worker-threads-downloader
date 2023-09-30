const fs = require('fs/promises')
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')

const [, , , threadCount, downloadUrl, fileTitle] = process.argv

if (isMainThread) {
    const [, , , threadCount, downloadUrl, fileTitle] = process.argv
    main(parseInt(threadCount), downloadUrl, fileTitle)
} else {
    const { start, end, downloadUrl } = workerData
    worker(downloadUrl, start, end)
}

async function worker(downloadUrl, start, end) {
    const file = await downloadFile(downloadUrl, start, end)
    parentPort.postMessage(file)
}

async function main(threadCount, downloadUrl, fileTitle) {
    const size = await getFileSize(downloadUrl)
    const sizePerThread = Math.round(size / threadCount)
    const promises = []
    const resultArray = []
    for (let i = 0; i < threadCount; i++) {
        const start = sizePerThread * i
        const end = start + sizePerThread
        const worker = new Worker(__filename, { workerData: { start, end, downloadUrl } })
        promises.push(
            new Promise((resolve) => {
                worker.on('message', (msg) => {
                    resultArray[i] = msg
                    resolve()
                })
            })
        )
    }
    await Promise.all(promises)
    const concatenated = await new Blob(resultArray).arrayBuffer()
    await fs.writeFile(`./${fileTitle}`, Buffer.from(concatenated))
}

async function getFileSize(downloadUrl) {
    const file = await fetch(downloadUrl, { method: 'HEAD' })
    return parseInt(file.headers.get('content-length'))
}

async function downloadFile(downloadUrl, start, end) {
    const file = await fetch(downloadUrl, { headers: { Range: `bytes=${start}-${end}` } })
    return file.arrayBuffer()
}
