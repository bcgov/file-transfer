

const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env

const ftpConfig = {
    FTP_HOST,
    FTP_PORT,
    FTP_USER,
    FTP_PASSWORD
}

for(let key in ftpConfig){
    if(!ftpConfig[key]){
        console.log(`FTP Configuration: ${key} missing`)
        // process.exit(1)
    }
    // console.log('Configuration Key is :', key)
}