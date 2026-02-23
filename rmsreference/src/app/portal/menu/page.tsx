'use client';

import { useState } from 'react';
import { Tabs, Title } from '@mantine/core';
import { IconCategory, IconToolsKitchen2, IconPlus, IconMenu2, IconChefHat, IconShoppingBag, IconList } from '@tabler/icons-react';
import { useLanguageStore } from '@/lib/store/language-store';
import { t } from '@/lib/utils/translations';
import {
  CategoriesPage,
  FoodItemsPage,
  AddOnGroupsPage,
  VariationGroupsPage,
  MenusPage,
  BuffetPage,
  ComboMealPage,
} from '@/features/menu';
import { MenuDataProvider } from '@/lib/contexts/menu-data-context';

export default function MenuPage() {
  const { language } = useLanguageStore();
  const [activeTab, setActiveTab] = useState<string>('categories');

  const handleTabChange = (value: string | null) => {
    if (value) {
      setActiveTab(value);
    }
  };

  return (
    <MenuDataProvider>
      <div className="page-title-bar">
        <Title order={1} style={{ margin: 0, textAlign: 'left' }}>
          {t('navigation.menu', language)}
        </Title>
      </div>

      <div className="page-sub-title-bar"></div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab value="categories" leftSection={<IconCategory size={16} />}>
              {t('menu.categories', language)}
            </Tabs.Tab>
            <Tabs.Tab value="add-ons" leftSection={<IconPlus size={16} />}>
              {t('menu.addOns', language)}
            </Tabs.Tab>
            <Tabs.Tab value="variation-groups" leftSection={<IconList size={16} />}>
              {t('menu.variationGroups', language) || 'Variation Groups'}
            </Tabs.Tab>
            <Tabs.Tab value="food-items" leftSection={<IconToolsKitchen2 size={16} />}>
              {t('menu.foodItems', language)}
            </Tabs.Tab>
            <Tabs.Tab value="menus" leftSection={<IconMenu2 size={16} />}>
              {t('menu.menus', language)}
            </Tabs.Tab>
            <Tabs.Tab value="buffets" leftSection={<IconChefHat size={16} />}>
              {t('menu.buffets', language)}
            </Tabs.Tab>
            <Tabs.Tab value="combo-meals" leftSection={<IconShoppingBag size={16} />}>
              {t('menu.comboMeals', language)}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="categories" pt="md" px="md" pb="md" keepMounted>
            <CategoriesPage />
          </Tabs.Panel>

          <Tabs.Panel value="add-ons" pt="md" px="md" pb="md" keepMounted>
            <AddOnGroupsPage />
          </Tabs.Panel>

          <Tabs.Panel value="variation-groups" pt="md" px="md" pb="md" keepMounted>
            <VariationGroupsPage />
          </Tabs.Panel>

          <Tabs.Panel value="food-items" pt="md" px="md" pb="md" keepMounted>
            <FoodItemsPage />
          </Tabs.Panel>

      <Tabs.Panel value="menus" pt="md" keepMounted>
        <MenusPage />
      </Tabs.Panel>

      <Tabs.Panel value="buffets" pt="md" keepMounted>
        <BuffetPage />
      </Tabs.Panel>

      <Tabs.Panel value="combo-meals" pt="md" keepMounted>
        <ComboMealPage />
      </Tabs.Panel>
        </Tabs>
      </div>
    </MenuDataProvider>
  );
}
