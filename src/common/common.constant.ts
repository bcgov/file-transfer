export const COMMON_CONSTANT = {
  cra_remoteDir: process.env.CRA_REMOTEDIR || '/pub/CSA/uaclient2cra', // upload to cra
  csa_remoteDir: process.env.CSA_REMOTEDIR || '/pub/CSA/uaclient2cra', // download from cra
  local_outboundDir: process.env.LOCAL_OUTBOUNDDIR || './storage',
  local_inboundDir: process.env.LOCAL_INBOUND || 'inbound',
  RESPONSE_STATUS: {
    DELIVERED: 'DELIVERED',
    FAILED: 'FAILED',
  },
  LOCAL_DIRECTORY: {
    outbound: 'outbound',
    temp: 'temp',
    inbound: 'inbound',
  },
  DESTINATION_ID: ['cra-ftp'],
}
