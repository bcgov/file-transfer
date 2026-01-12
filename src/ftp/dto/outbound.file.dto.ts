import { IsArray, IsNotEmpty, IsString } from 'class-validator'

export class CreateFileDto {
  @IsString()
  @IsNotEmpty()
  system: string

  @IsString()
  @IsNotEmpty()
  flow: string

  @IsString()
  @IsNotEmpty()
  fileType: string

  @IsArray()
  @IsNotEmpty()
  payload: any[]
}
