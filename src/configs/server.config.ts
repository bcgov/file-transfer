import { Logger } from '@nestjs/common'
const { LOCAL_STORAGE_DIR, CRA_PUB_CERT_PATH, CRA_PRIVATE_KEY_PATH } = process.env

const logger = new Logger('SERVER-CONFIG')

const serverConfig = {
  LOCAL_STORAGE_DIR,
  CRA_PUB_CERT_PATH,
  CRA_PRIVATE_KEY_PATH,
}

for (const key in serverConfig) {
  if (!serverConfig[key]) {
    logger.log(`SERVER CONFIG KEY : ${key} IS MISSING IN ENV`)
    throw new Error(`SERVER CONFIG KEY: ${key} IS MISSING IN ENV`)
  }
}

export const SERVER_CONFIG = {
  LOCAL_STORAGE_DIR,
  CRA_PUB_CERT_PATH,
  CRA_PRIVATE_KEY_PATH,
}
