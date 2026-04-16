import axios from 'axios';
import Constants from 'expo-constants';

const menuHost = 'https://pl1.lumiva.agency';

export interface MenuItem {
  key: string;
  label: string;
  route?: string;
  icon?: string;
  enabled: boolean;
  children?: MenuItem[];
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export async function fetchMenu(tenantId: string): Promise<MenuGroup[]> {
  try {
    // Получаем модули и компоненты из pl1.lumiva-ui
    const [modulesRes, componentsRes] = await Promise.all([
      axios.get(`${menuHost}/api/platform/tenants/${tenantId}/modules`),
      axios.get(`${menuHost}/api/platform/tenants/${tenantId}/components`),
    ]);

    const modules = modulesRes.data || [];
    const components = componentsRes.data || [];

    // Создаем структуру меню на основе доступных модулей и компонентов
    const menuGroups: MenuGroup[] = [];

    // Главная
    menuGroups.push({
      label: 'Основное',
      items: [
        { key: 'dashboard', label: 'Главная', route: 'Dashboard', enabled: true },
      ],
    });

    // Лиды (если модуль включен)
    const leadsModule = modules.find((m: any) => m.key === 'leads');
    if (leadsModule?.enabled) {
      menuGroups.push({
        label: 'Лиды',
        items: [
          { key: 'leads', label: 'Все лиды', route: 'Leads', enabled: true },
          { key: 'leads-create', label: 'Создать лид', route: 'Leads', enabled: true },
          { key: 'leads-lost', label: 'Утраченные лиды', route: 'Leads', enabled: true },
          { key: 'leads-analytics', label: 'Аналитика', route: 'Leads', enabled: true },
          { key: 'leads-roi', label: 'ROI', route: 'Leads', enabled: true },
        ],
      });
    }

    // Проекты
    const projectsModule = modules.find((m: any) => m.key === 'projects');
    if (projectsModule?.enabled) {
      menuGroups.push({
        label: 'Проекты',
        items: [
          { key: 'projects', label: 'Все проекты', route: 'Projects', enabled: true },
        ],
      });
    }

    // Продажи
    const salesModule = modules.find((m: any) => m.key === 'sales');
    if (salesModule?.enabled) {
      menuGroups.push({
        label: 'Продажи',
        items: [
          { key: 'sales', label: 'Все продажи', route: 'Sales', enabled: true },
        ],
      });
    }

    // Контакты
    const contactsComponent = components.find((c: any) => c.key === 'contacts');
    if (contactsComponent?.enabled) {
      menuGroups.push({
        label: 'Контакты',
        items: [
          { key: 'contacts', label: 'Все контакты', route: 'Contacts', enabled: true },
        ],
      });
    }

    // Компании
    const companiesComponent = components.find((c: any) => c.key === 'companies');
    if (companiesComponent?.enabled) {
      menuGroups.push({
        label: 'Компании',
        items: [
          { key: 'companies', label: 'Все компании', route: 'Companies', enabled: true },
        ],
      });
    }

    // Сотрудники
    const staffComponent = components.find((c: any) => c.key === 'staff');
    if (staffComponent?.enabled) {
      menuGroups.push({
        label: 'Сотрудники',
        items: [
          { key: 'staff', label: 'Все сотрудники', route: 'Staff', enabled: true },
        ],
      });
    }

    // Маркетинг
    const marketingModule = modules.find((m: any) => m.key === 'marketing');
    if (marketingModule?.enabled) {
      menuGroups.push({
        label: 'Маркетинг',
        items: [
          { key: 'marketing', label: 'Маркетинг', route: 'Marketing', enabled: true },
        ],
      });
    }

    // Чат
    const chatComponent = components.find((c: any) => c.key === 'chat');
    if (chatComponent?.enabled) {
      menuGroups.push({
        label: 'Коммуникации',
        items: [
          { key: 'chat', label: 'Чат', route: 'Chat', enabled: true },
        ],
      });
    }

    // Счета клиентов
    const clientAccountsComponent = components.find((c: any) => c.key === 'client-accounts');
    if (clientAccountsComponent?.enabled) {
      menuGroups.push({
        label: 'Финансы',
        items: [
          { key: 'client-accounts', label: 'Счета клиентов', route: 'ClientAccounts', enabled: true },
        ],
      });
    }

    return menuGroups;
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    // Возвращаем базовое меню при ошибке
    return [
      {
        label: 'Основное',
        items: [
          { key: 'dashboard', label: 'Главная', route: 'Dashboard', enabled: true },
          { key: 'leads', label: 'Лиды', route: 'Leads', enabled: true },
          { key: 'projects', label: 'Проекты', route: 'Projects', enabled: true },
          { key: 'sales', label: 'Продажи', route: 'Sales', enabled: true },
          { key: 'chat', label: 'Чат', route: 'Chat', enabled: true },
        ],
      },
    ];
  }
}








