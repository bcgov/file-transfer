

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env

const ftpConfig = {
    FTP_HOST,
    FTP_PORT,
    FTP_USER,
    FTP_PASSWORD
}

for(let key in ftpConfig){
    if(!ftpConfig[key]){
        console.log(`FTP CONFIG KEY : ${key} IS MISSING IN ENV`)
        // process.exit(1)
        throw new Error(`FTP CONFIG KEY ${key} IS MISSING IN ENV `)
    }
    // console.log('Configuration Key is :', key)
}