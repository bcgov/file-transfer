const { PORT, INBOUND_DIR, OUTBOUND_DIR, LOCAL_STORAGE_DIR } = process.env
import { Logger } from '@nestjs/common'

const logger = new Logger('FTP-CONFIG')

const serverConfig = {
  PORT,
  INBOUND_DIR,
  OUTBOUND_DIR,
  LOCAL_STORAGE_DIR,
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
}
