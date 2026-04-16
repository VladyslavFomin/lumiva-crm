import { api } from './client';

export interface SaleDto {
  id: string;
  tenantId: string | null;
  leadId: string | null;
  projectId: string | null;
  amount: number;
  currency: string;
  status: string;
  saleDate: string | null;
  guestName: string | null;
  channelId: string | null;
  createdAt: string;
}

export interface Sale {
  id: string;
  leadId: string | null;
  projectId: string | null;
  amount: number;
  currency: string;
  status: string;
  saleDate: string | null;
  createdAt: string;
}

function mapSale(dto: SaleDto): Sale {
  return {
    id: dto.id,
    leadId: dto.leadId,
    projectId: dto.projectId,
    amount: dto.amount,
    currency: dto.currency || 'EUR',
    status: dto.status,
    saleDate: dto.saleDate,
    createdAt: dto.createdAt,
  };
}

export async function fetchSales() {
  const res = await api.get<SaleDto[] | { items?: SaleDto[] }>('/sales');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapSale);
}

export async function fetchSale(id: string): Promise<Sale> {
  const res = await api.get<SaleDto>(`/sales/${id}`);
  return mapSale(res.data);
}
