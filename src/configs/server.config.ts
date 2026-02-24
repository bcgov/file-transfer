import { Logger } from '@nestjs/common'
const {
  INBOUND_DIR,
  OUTBOUND_DIR,
  LOCAL_STORAGE_DIR,
  CRA_PUB_CERT_PATH = '/certs/cra-pub-cert.pem',
} = process.env

const logger = new Logger('FTP-CONFIG')

const serverConfig = {
  INBOUND_DIR,
  OUTBOUND_DIR,
  LOCAL_STORAGE_DIR,
  CRA_PUB_CERT_PATH,
}

for (const key in serverConfig) {
  if (!serverConfig[key]) {
    logger.log(`SERVER CONFIG KEY : ${key} IS MISSING IN ENV`)
    throw new Error(`SERVER CONFIG KEY: ${key} IS MISSING IN ENV`)
  }
}

export const SERVER_CONFIG = {
  INBOUND_DIR,
  OUTBOUND_DIR,
  LOCAL_STORAGE_DIR,
  CRA_PUB_CERT_PATH,
}
