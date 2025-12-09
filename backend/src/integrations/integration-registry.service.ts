// src/integrations/integration-registry.service.ts
import { Injectable } from '@nestjs/common';
import { WooCommerceAdapter } from './woocommerce/woocommerce.adapter';
import type { SalesIntegrationAdapter } from './sales-integration.adapter';
import type { IntegrationKind } from './integration-kind.enum';

@Injectable()
export class IntegrationRegistryService {
  private readonly adapters = new Map<IntegrationKind, SalesIntegrationAdapter>();

  constructor(private readonly wooAdapter: WooCommerceAdapter) {
    this.register(this.wooAdapter);
  }

  private register(adapter: SalesIntegrationAdapter) {
    this.adapters.set(adapter.kind, adapter);
  }

  getAdapter(kind: IntegrationKind): SalesIntegrationAdapter | undefined {
    return this.adapters.get(kind);
  }

  listAdapters(): { kind: IntegrationKind; label: string }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      kind: a.kind,
      label: a.label,
    }));
  }
}