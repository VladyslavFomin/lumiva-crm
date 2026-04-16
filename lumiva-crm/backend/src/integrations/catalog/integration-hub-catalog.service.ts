import { Injectable } from '@nestjs/common';

import { INTEGRATION_HUB_CATALOG } from './integration-hub-catalog';
import type { IntegrationHubCatalogEntry } from './integration-hub.types';

@Injectable()
export class IntegrationHubCatalogService {
  /** Каталог для CRM-хаба: модули и флаги возможностей (без секретов). */
  getCatalog(): IntegrationHubCatalogEntry[] {
    return INTEGRATION_HUB_CATALOG;
  }

  getById(id: string): IntegrationHubCatalogEntry | undefined {
    return INTEGRATION_HUB_CATALOG.find((e) => e.id === id);
  }
}
