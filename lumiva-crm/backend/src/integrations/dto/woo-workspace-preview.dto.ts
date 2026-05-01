import { IsUUID } from 'class-validator';

/** POST /integrations/:id/woo-workspace-preview */
export class WooWorkspacePreviewDto {
  @IsUUID()
  customObjectId!: string;
}
