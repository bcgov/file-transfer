import { IsNotEmpty, IsString } from 'class-validator'

export class CreateFileDto {
  @IsString()
  @IsNotEmpty()
  fileName: string

  @IsString()
  @IsNotEmpty()
  destinationId: string
}
