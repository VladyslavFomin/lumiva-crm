import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /* ---------- categories ---------- */

  @Get('categories')
  listCategories(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listCategories(user.tenantId);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createCategory(user.tenantId, dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateCategory(user.tenantId, id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteCategory(user.tenantId, id);
  }

  /* ---------- field defs ---------- */

  @Get('field-defs')
  listFieldDefs(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listFieldDefs(user.tenantId);
  }

  @Post('field-defs')
  createFieldDef(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createFieldDef(user.tenantId, dto);
  }

  @Patch('field-defs/:id')
  updateFieldDef(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateFieldDef(user.tenantId, id, dto);
  }

  @Delete('field-defs/:id')
  deleteFieldDef(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteFieldDef(user.tenantId, id);
  }

  @Post('field-defs/reorder')
  reorderFieldDefs(@CurrentUser() user: CurrentUserPayload, @Body() dto: { orderedIds: string[] }) {
    return this.service.reorderFieldDefs(user.tenantId, dto?.orderedIds || []);
  }

  /* ---------- attributes ---------- */

  @Get('attributes')
  listAttributes(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listAttributes(user.tenantId);
  }

  @Post('attributes')
  createAttribute(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createAttribute(user.tenantId, dto);
  }

  @Patch('attributes/:id')
  updateAttribute(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateAttribute(user.tenantId, id, dto);
  }

  @Delete('attributes/:id')
  deleteAttribute(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteAttribute(user.tenantId, id);
  }

  @Post('attributes/:id/values')
  addAttributeValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.addAttributeValue(user.tenantId, id, dto);
  }

  @Delete('attributes/:id/values/:valueId')
  removeAttributeValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('valueId') valueId: string,
  ) {
    return this.service.removeAttributeValue(user.tenantId, id, valueId);
  }

  /* ---------- stock (перед :id, чтобы "stock" не матчился как productId) ---------- */

  @Get('stock')
  listStock(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
  ) {
    return this.service.listStock(user.tenantId, {
      search,
      categoryId,
      lowStockOnly: lowStockOnly === 'true',
    });
  }

  @Post('stock/adjust')
  adjustStock(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.adjustStock(user.tenantId, user.userId ?? null, dto);
  }

  @Get('stock/movements')
  listStockMovements(
    @CurrentUser() user: CurrentUserPayload,
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listStockMovements(user.tenantId, {
      productId,
      variantId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /* ---------- import/export (перед :id, чтобы "import"/"export" не матчились как productId) ---------- */

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any) {
    return this.service.previewImport(user.tenantId, file);
  }

  @Post('import/apply')
  applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    dto: { importId: string; mapping: Record<string, string | null>; updateExisting?: boolean },
  ) {
    return this.service.applyImport(user.tenantId, dto);
  }

  @Get('export')
  async exportProducts(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query('format') format?: 'xlsx' | 'csv',
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const { buffer, filename, contentType } = await this.service.exportProducts(user.tenantId, {
      format,
      status,
      categoryId,
    });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /* ---------- products ---------- */

  @Get()
  listProducts(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('isVariable') isVariable?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listProducts(user.tenantId, {
      status,
      categoryId,
      isVariable: isVariable === undefined ? undefined : isVariable === 'true',
      search,
      sort,
      order,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  createProduct(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createProduct(user.tenantId, dto);
  }

  @Get(':id')
  getProduct(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getProduct(user.tenantId, id);
  }

  @Patch(':id')
  updateProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateProduct(user.tenantId, id, dto);
  }

  @Delete(':id')
  deleteProduct(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteProduct(user.tenantId, id);
  }

  @Post(':id/duplicate')
  duplicateProduct(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.duplicateProduct(user.tenantId, id);
  }

  /* ---------- variants ---------- */

  @Get(':id/variants')
  listVariants(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listVariants(user.tenantId, id);
  }

  @Post(':id/variants/generate')
  generateVariants(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { attributeIds: string[] },
  ) {
    return this.service.generateVariants(user.tenantId, id, dto?.attributeIds || []);
  }

  @Patch(':id/variants/:variantId')
  updateVariant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: any,
  ) {
    return this.service.updateVariant(user.tenantId, id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  deleteVariant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ) {
    return this.service.deleteVariant(user.tenantId, id, variantId);
  }
}
