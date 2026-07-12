import {
  BadRequestException,
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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { getUploadsRoot } from '../common/uploads-root.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ProductsService } from './products.service';

const PRODUCT_IMAGE_ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

@Controller('products')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('products', 'read')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  /* ---------- categories ---------- */

  @Get('categories')
  listCategories(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listCategories(user.tenantId);
  }

  @Get('categories/tree')
  listCategoriesWithCounts(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listCategoriesWithCounts(user.tenantId);
  }

  @Post('categories')
  @RequirePermission('products', 'write')
  createCategory(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createCategory(user.tenantId, dto);
  }

  @Patch('categories/:id')
  @RequirePermission('products', 'write')
  updateCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateCategory(user.tenantId, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermission('products', 'delete')
  deleteCategory(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteCategory(user.tenantId, id);
  }

  /* ---------- field defs (конструктор полей — только те, у кого products_manage_fields) ---------- */

  @Get('field-defs')
  listFieldDefs(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listFieldDefs(user.tenantId);
  }

  @Get('field-defs/groups')
  listFieldGroups(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listFieldGroups(user.tenantId);
  }

  @Post('field-defs')
  @RequirePermission('products_manage_fields', 'write')
  createFieldDef(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createFieldDef(user.tenantId, dto);
  }

  @Patch('field-defs/:id')
  @RequirePermission('products_manage_fields', 'write')
  updateFieldDef(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateFieldDef(user.tenantId, id, dto);
  }

  @Delete('field-defs/:id')
  @RequirePermission('products_manage_fields', 'delete')
  deleteFieldDef(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteFieldDef(user.tenantId, id);
  }

  @Post('field-defs/reorder')
  @RequirePermission('products_manage_fields', 'write')
  reorderFieldDefs(@CurrentUser() user: CurrentUserPayload, @Body() dto: { orderedIds: string[] }) {
    return this.service.reorderFieldDefs(user.tenantId, dto?.orderedIds || []);
  }

  /* ---------- attributes (тоже часть конструктора полей) ---------- */

  @Get('attributes')
  listAttributes(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listAttributes(user.tenantId);
  }

  @Post('attributes')
  @RequirePermission('products_manage_fields', 'write')
  createAttribute(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createAttribute(user.tenantId, dto);
  }

  @Patch('attributes/:id')
  @RequirePermission('products_manage_fields', 'write')
  updateAttribute(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateAttribute(user.tenantId, id, dto);
  }

  @Delete('attributes/:id')
  @RequirePermission('products_manage_fields', 'delete')
  deleteAttribute(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteAttribute(user.tenantId, id);
  }

  @Post('attributes/:id/values')
  @RequirePermission('products_manage_fields', 'write')
  addAttributeValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.addAttributeValue(user.tenantId, id, dto);
  }

  @Delete('attributes/:id/values/:valueId')
  @RequirePermission('products_manage_fields', 'delete')
  removeAttributeValue(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('valueId') valueId: string,
  ) {
    return this.service.removeAttributeValue(user.tenantId, id, valueId);
  }

  /* ---------- locations (склады) ---------- */

  @Get('locations')
  listLocations(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listLocations(user.tenantId);
  }

  @Post('locations')
  @RequirePermission('products_manage_stock', 'write')
  createLocation(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createLocation(user.tenantId, dto);
  }

  @Patch('locations/:id')
  @RequirePermission('products_manage_stock', 'write')
  updateLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateLocation(user.tenantId, id, dto);
  }

  @Delete('locations/:id')
  @RequirePermission('products_manage_stock', 'delete')
  deleteLocation(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteLocation(user.tenantId, id);
  }

  /* ---------- stock (перед :id, чтобы "stock" не матчился как productId) ---------- */

  @Get('stock')
  listStock(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.service.listStock(user.tenantId, {
      search,
      categoryId,
      lowStockOnly: lowStockOnly === 'true',
      locationId,
    });
  }

  @Post('stock/adjust')
  @RequirePermission('products_manage_stock', 'write')
  adjustStock(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.adjustStock(user.tenantId, user.userId ?? null, dto);
  }

  @Post('stock/transfer')
  @RequirePermission('products_manage_stock', 'write')
  transferStock(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.transferStock(user.tenantId, user.userId ?? null, dto);
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

  /* ---------- image upload (для главного фото товара и полей типа media/gallery) ---------- */

  @Post('images/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          if (!tenantId) {
            cb(new BadRequestException('No tenant'), '');
            return;
          }
          const dir = join(getUploadsRoot(), 'products', tenantId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const e = PRODUCT_IMAGE_ALLOWED_EXT.includes(ext) ? ext : '.png';
          cb(null, `${randomUUID()}${e}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpeg|gif|webp)$/.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Разрешены только изображения PNG, JPEG, GIF или WebP'), false);
        }
      },
    }),
  )
  @RequirePermission('products', 'write')
  uploadImage(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: { filename: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    return { url: `/v1/uploads/products/${user.tenantId}/${file.filename}` };
  }

  /* ---------- import/export (перед :id, чтобы "import"/"export" не матчились как productId) ---------- */

  @Post('import/preview')
  @RequirePermission('products', 'write')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any) {
    return this.service.previewImport(user.tenantId, file);
  }

  @Post('import/apply')
  @RequirePermission('products', 'write')
  applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    dto: {
      importId: string;
      mapping: Record<string, string | null>;
      updateExisting?: boolean;
      newFields?: Array<{ column: string; label: string }>;
    },
  ) {
    return this.service.applyImport(user.tenantId, dto);
  }

  @Get('export')
  async exportProducts(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query('format') format?: 'xlsx' | 'csv' | 'pdf',
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

  @Post('bulk-update')
  @RequirePermission('products', 'write')
  bulkUpdate(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    dto: {
      productIds: string[];
      categoryId?: string | null;
      status?: string;
      tagsToAdd?: string[];
      tagsToRemove?: string[];
    },
  ) {
    return this.service.bulkUpdateProducts(user.tenantId, dto);
  }

  @Get('publication-queue')
  listPublicationQueue(@CurrentUser() user: CurrentUserPayload) {
    return this.service.listPublicationQueue(user.tenantId);
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
  @RequirePermission('products', 'write')
  createProduct(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.createProduct(user.tenantId, dto);
  }

  @Get(':id')
  getProduct(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getProduct(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('products', 'write')
  updateProduct(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.updateProduct(user.tenantId, id, dto, user.userId ?? null);
  }

  @Delete(':id')
  @RequirePermission('products', 'delete')
  deleteProduct(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.deleteProduct(user.tenantId, id);
  }

  @Post(':id/duplicate')
  @RequirePermission('products', 'write')
  duplicateProduct(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.duplicateProduct(user.tenantId, id);
  }

  @Get(':id/changes')
  listChangeLogs(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listChangeLogs(user.tenantId, id);
  }

  /* ---------- публикация в публичный каталог (модерация) ---------- */

  @Post(':id/request-publication')
  @RequirePermission('products', 'write')
  requestPublication(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.requestPublication(user.tenantId, id, user.userId ?? null);
  }

  @Post(':id/approve-publication')
  @RequirePermission('products_publish', 'write')
  approvePublication(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.approvePublication(user.tenantId, id, user.userId ?? null);
  }

  @Post(':id/reject-publication')
  @RequirePermission('products_publish', 'write')
  rejectPublication(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { reason?: string },
  ) {
    return this.service.rejectPublication(user.tenantId, id, dto?.reason || null);
  }

  @Post(':id/unpublish')
  @RequirePermission('products_publish', 'write')
  unpublish(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.unpublish(user.tenantId, id);
  }

  /* ---------- variants ---------- */

  @Get(':id/variants')
  listVariants(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listVariants(user.tenantId, id);
  }

  @Post(':id/variants/generate')
  @RequirePermission('products', 'write')
  generateVariants(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { attributeIds: string[] },
  ) {
    return this.service.generateVariants(user.tenantId, id, dto?.attributeIds || []);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermission('products', 'write')
  updateVariant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: any,
  ) {
    return this.service.updateVariant(user.tenantId, id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermission('products', 'delete')
  deleteVariant(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ) {
    return this.service.deleteVariant(user.tenantId, id, variantId);
  }
}
