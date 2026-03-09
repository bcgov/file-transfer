import { Logger } from '@nestjs/common'

const { S3_URI, S3_BUCKET, S3_PREFIX = '' } = process.env

const logger = new Logger('S3-CONFIG')

const s3Config = {
  S3_URI,
  S3_BUCKET,
}

for (const key in s3Config) {
  if (!s3Config[key]) {
    logger.log(`S3 CONFIG KEY : ${key} IS MISSING IN ENV`)
    throw new Error(`S3 CONFIG KEY ${key} IS MISSING IN ENV`)
  }
}

function parseS3Uri(uri: string) {
  const url = new URL(uri)
  return {
    endPoint: url.hostname,
    port: Number(url.port) || (url.protocol === 'https:' ? 443 : 9000),
    useSSL: url.protocol === 'https:',
    accessKey: decodeURIComponent(url.username),
    secretKey: decodeURIComponent(url.password),
  }
}

export const S3_CONFIG = {
  ...parseS3Uri(S3_URI),
  bucket: S3_BUCKET,
  prefix: S3_PREFIX ? (S3_PREFIX.endsWith('/') ? S3_PREFIX : `${S3_PREFIX}/`) : '',
}
