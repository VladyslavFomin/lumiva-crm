import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EmbedFormsService } from './embed-forms.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateEmbedFormDto } from './dto/create-embed-form.dto';
import { UpdateEmbedFormDto } from './dto/update-embed-form.dto';

@Controller('embed-forms')
@UseGuards(JwtAuthGuard)
export class EmbedFormsController {
  constructor(private readonly embedForms: EmbedFormsService) {}

  @Get('templates')
  templates() {
    return this.embedForms.listTemplates();
  }

  @Get()
  list(@CurrentUser() user: { tenantId: string }) {
    return this.embedForms.list(user.tenantId);
  }

  @Get(':id')
  one(@CurrentUser() user: { tenantId: string }, @Param('id') id: string) {
    return this.embedForms.getForTenant(user.tenantId, id);
  }

  @Post()
  create(
    @CurrentUser() user: { tenantId: string },
    @Body() body: CreateEmbedFormDto,
  ) {
    return this.embedForms.create(user.tenantId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { tenantId: string },
    @Param('id') id: string,
    @Body() body: UpdateEmbedFormDto,
  ) {
    return this.embedForms.update(user.tenantId, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { tenantId: string; sub: string; id?: string },
    @Param('id') id: string,
  ) {
    return this.embedForms.remove(user.tenantId, id);
  }

  @Post(':id/preview-token')
  previewToken(
    @CurrentUser() user: { tenantId: string; sub: string; id: string },
    @Param('id') id: string,
  ) {
    const uid = user.id || user.sub;
    return this.embedForms.getPreviewToken(user.tenantId, id, uid);
  }
}
