import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class AttachmentRefDto {
  @IsString()
  @MinLength(1)
  filename: string;

  @IsString()
  @MinLength(1)
  relativePath: string;

  @IsInt()
  @Min(0)
  sizeBytes: number;
}
