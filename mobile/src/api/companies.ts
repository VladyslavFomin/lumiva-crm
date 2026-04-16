import { api } from './client';

export interface CompanyDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  size: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  industry: string | null;
  size: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function mapCompany(dto: CompanyDto): Company {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    website: dto.website,
    email: dto.email,
    phone: dto.phone,
    address: dto.address,
    industry: dto.industry,
    size: dto.size,
    tags: dto.tags || [],
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export async function fetchCompanies(): Promise<Company[]> {
  const res = await api.get<CompanyDto[] | { items?: CompanyDto[] }>('/companies');
  const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
  return data.map(mapCompany);
}

export async function fetchCompany(id: string): Promise<Company> {
  const res = await api.get<CompanyDto>(`/companies/${id}`);
  return mapCompany(res.data);
}

export interface CreateCompanyDto {
  name: string;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  industry?: string | null;
  size?: string | null;
  tags?: string[] | null;
}

export async function createCompany(payload: CreateCompanyDto) {
  const res = await api.post<CompanyDto>('/companies', payload);
  return mapCompany(res.data);
}

export interface UpdateCompanyDto {
  id: string;
  name?: string | null;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  industry?: string | null;
  size?: string | null;
  tags?: string[] | null;
}

export async function updateCompany(payload: UpdateCompanyDto) {
  const { id, ...body } = payload;
  const res = await api.patch<CompanyDto>(`/companies/${id}`, body);
  return mapCompany(res.data);
}

export async function deleteCompany(id: string) {
  await api.delete(`/companies/${id}`);
}








