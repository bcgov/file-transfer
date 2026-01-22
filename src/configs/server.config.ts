const { PORT, APP_NAME, CSA_BACKEND_API_BASE_URL } = process.env
import { Logger } from '@nestjs/common'

const logger = new Logger('FTP-CONFIG')

const serverConfig = {
  PORT,
  APP_NAME,
  CSA_BACKEND_API_BASE_URL,
}

for (const key in serverConfig) {
  if (!serverConfig[key]) {
    logger.log(`SERVER CONFIG KEY : ${key} IS MISSING IN ENV`)
    throw new Error(`SERVER CONFIG KEY: ${key} IS MISSING IN ENV`)
  }
}
