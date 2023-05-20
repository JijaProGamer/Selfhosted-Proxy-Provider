import proxyAPI from "multi-type-proxy"
import proxyTesterAPI from "fast-proxy-tester"
import ProxyLists  from "proxy-lists"

function getRawProxies(){
    return new Promise((resolve, reject) => {
        let result = []

        ProxyLists.getProxies({
            unique: true,
            anonymityLevels: "elite",
            browser: {
                headless: true,
                slowMo: 0,
                timeout: 15000,
            },
        })
        .on('data', (proxies) => { for(let proxy of proxies) result.push(proxy) })
        .on('error', () => {})
        .once('end', () => resolve(result))
    })
}

function getProxies(timeout, workPerQueue){
    return new Promise(async (resolve, reject) => {
        let result = []
        let raw_proxies = await getRawProxies()
        let workQueue = []

        for(let raw_proxy of raw_proxies){
            if(raw_proxy.protocols){
                workQueue.push(() => new Promise((resolve, reject) => {
                    let proxy = `${raw_proxy.protocols[0]}://${raw_proxy.ipAddress}:${raw_proxy.port}`
                    let proxyTester = proxyTesterAPI(proxy, timeout)
                    let finished = false

                    setTimeout(() => {
                        if(!finished) resolve()
                    }, timeout + 100)
                    
                    proxyTester.testPrivacy().then((privacy) => {
                        if(privacy.privacy == "elite"){
                            result.push({
                                proxy: proxy,
                                ip: privacy.ip,
                                ping: 0,
                                geolocation: privacy.geo
                            })
                        }

                        finished = true
                        resolve()
                    }).catch(() => {finished = true; resolve()})
                }))
            }
        }

        let batchNumber = 0;
        let workFinished = 0;
        let isWorking = false
        let batches = Math.ceil(workQueue.length / workPerQueue)
        let surplus = (batches * workPerQueue) - workQueue.length

        let interval = setInterval(() => {
            if((workFinished == workPerQueue) || (batchNumber == batches && workFinished == surplus)){
                isWorking = false
            }

            console.log(batchNumber, batches, workFinished, surplus)
            if(!isWorking && batchNumber == batches){
                clearInterval(interval)
                resolve(result)
            }

            if(!isWorking){
                workFinished = 0
                isWorking = true

                for(let i = workPerQueue * batchNumber; i < workPerQueue * (batchNumber + 1); i++){
                    if(workQueue[i]){
                        workQueue[i]().then(() => {
                            workFinished++;
                        })
                    }
                }

                batchNumber ++;
            }
        }, 1000)
    })
}

console.time("start")
getProxies(15000, 5000).then(proxies => {
    console.log(proxies)
    console.timeEnd("start")
})

/*let proxyServer = new proxyAPI()

proxyServer.listen(8080)*/