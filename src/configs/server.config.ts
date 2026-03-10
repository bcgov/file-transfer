import { Logger } from '@nestjs/common'

const { LOCAL_STORAGE_DIR, CRA_PUB_CERT_PATH, CRA_PRIVATE_KEY_PATH, ENCRYPTION_ENABLED } =
  process.env

const logger = new Logger('SERVER-CONFIG')

const encryptionEnabled = ENCRYPTION_ENABLED === 'true'

const requiredConfig: Record<string, string | undefined> = {
  LOCAL_STORAGE_DIR,
}

if (encryptionEnabled) {
  requiredConfig.CRA_PUB_CERT_PATH = CRA_PUB_CERT_PATH
  requiredConfig.CRA_PRIVATE_KEY_PATH = CRA_PRIVATE_KEY_PATH
}

for (const key in requiredConfig) {
  if (!requiredConfig[key]) {
    logger.log(`SERVER CONFIG KEY : ${key} IS MISSING IN ENV`)
    throw new Error(`SERVER CONFIG KEY: ${key} IS MISSING IN ENV`)
  }
}

export const SERVER_CONFIG = {
  LOCAL_STORAGE_DIR,
  CRA_PUB_CERT_PATH,
  CRA_PRIVATE_KEY_PATH,
  encryptionEnabled,
}
