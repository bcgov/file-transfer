import { ApiProperty } from '@nestjs/swagger'

export class UploadResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number

  @ApiProperty({ example: 'SUCCESS' })
  status: string

  @ApiProperty({ example: 'File uploaded successfully to S3' })
  message: string

  @ApiProperty({ example: 'test.txt.p7m' })
  fileName: string

  @ApiProperty({ example: 'cra' })
  destinationId: string
}

export class DeliveryStatusResponseDto {
  @ApiProperty({ example: 'SUCCESS', enum: ['SUCCESS', 'FAILED'] })
  status: string

  @ApiProperty({ example: 'File delivered successfully' })
  message: string
}
