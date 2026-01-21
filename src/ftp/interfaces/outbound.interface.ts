import { File as MulterFile } from 'multer'

export interface UploadFileHeaders {
  servicename: string
  userid: string
}

export interface UploadFileInterface {
  headers: UploadFileHeaders
  file: MulterFile
}
