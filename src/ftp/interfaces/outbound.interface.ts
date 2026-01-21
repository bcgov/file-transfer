import { File as MulterFile } from 'multer'

export interface UploadFileInterface {
  destinationId: string
  fileName: string
  file: MulterFile
}
