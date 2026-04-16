import { IsOptional, IsString } from 'class-validator';

export class PatchEmailSignatureDto {
  @IsOptional()
  @IsString()
  signatureHtml?: string | null;

  @IsOptional()
  @IsString()
  signatureText?: string | null;
}
