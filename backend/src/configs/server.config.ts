

const { PORT, APP_NAME, CSA_BACKEND_API_BASE_URL } = process.env


const serverConfig ={
    PORT,
    APP_NAME,
    CSA_BACKEND_API_BASE_URL
}

for(let key in serverConfig){
    if(!serverConfig[key]){
        console.log(`SERVER CONFIG KEY: ${key} IS MISSING`)
        throw new Error(`SERVER CONFIG KEY: ${key} IS MISSING IN ENV`)
    }
}