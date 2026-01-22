const { FTP_HOST, FTP_PORT, FTP_USER, FTP_PASSWORD } = process.env
import { Logger } from '@nestjs/common'

const logger = new Logger('FTP-CONFIG')

const ftpConfig = {
  FTP_HOST,
  FTP_PORT,
  FTP_USER,
  FTP_PASSWORD,
}

for (const key in ftpConfig) {
  if (!ftpConfig[key]) {
    logger.log(`FTP CONFIG KEY : ${key} IS MISSING IN ENV`)
    // process.exit(1)
    // throw new Error(`FTP CONFIG KEY ${key} IS MISSING IN ENV `)
  }
}
