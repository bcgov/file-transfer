// ftp/dto/outbound-upload.response.dto.ts
import { ApiProperty } from '@nestjs/swagger'

export class OutboundUploadResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number

  @ApiProperty({ example: 'File uploaded successfully' })
  message: string

  @ApiProperty({ example: 'test.txt' })
  file: string
}
