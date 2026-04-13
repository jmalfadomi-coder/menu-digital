import { PrismaClient, Role, TenantRole, Locale, Plan, ItemStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database…');

  // ─── Super Admin ────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@menu.digital' },
    update: {},
    create: {
      email: 'superadmin@menu.digital',
      password: await argon2.hash('Admin1234!'),
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log(`✓ Super admin: ${superAdmin.email}`);

  // ─── Demo Restaurant ─────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-restaurant' },
    update: {},
    create: {
      slug: 'demo-restaurant',
      name_en: 'Demo Restaurant',
      name_es: 'Restaurante Demo',
      email: 'owner@demo-restaurant.com',
      phone: '+1-555-0100',
      city: 'Miami',
      country: 'US',
      primaryColor: '#E63946',
      accentColor: '#1D3557',
      heroTitle_en: 'Welcome to Demo Restaurant',
      heroTitle_es: 'Bienvenidos al Restaurante Demo',
      heroSubtitle_en: 'Fresh ingredients, bold flavors',
      heroSubtitle_es: 'Ingredientes frescos, sabores audaces',
      defaultLocale: Locale.EN,
      supportedLocales: [Locale.EN, Locale.ES],
      plan: Plan.PRO,
      isActive: true,
      isVerified: true,
    },
  });
  console.log(`✓ Tenant: ${tenant.slug}`);

  // ─── Restaurant Owner ─────────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo-restaurant.com' },
    update: {},
    create: {
      email: 'owner@demo-restaurant.com',
      password: await argon2.hash('Owner1234!'),
      firstName: 'Jane',
      lastName: 'Smith',
      role: Role.RESTAURANT_OWNER,
      isActive: true,
    },
  });

  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: owner.id, tenantId: tenant.id } },
    update: {},
    create: { userId: owner.id, tenantId: tenant.id, role: TenantRole.RESTAURANT_OWNER },
  });
  console.log(`✓ Owner: ${owner.email}`);

  // ─── Menu ─────────────────────────────────────────────────
  const menu = await prisma.menu.upsert({
    where: { id: 'seed-menu-1' },
    update: {},
    create: {
      id: 'seed-menu-1',
      tenantId: tenant.id,
      name_en: 'Main Menu',
      name_es: 'Menú Principal',
      isActive: true,
      sortOrder: 0,
      publishedAt: new Date(),
    },
  });

  // ─── Category ─────────────────────────────────────────────
  const category = await prisma.category.upsert({
    where: { id: 'seed-cat-1' },
    update: {},
    create: {
      id: 'seed-cat-1',
      menuId: menu.id,
      tenantId: tenant.id,
      name_en: 'Burgers',
      name_es: 'Hamburguesas',
      description_en: 'Handcrafted burgers made fresh daily',
      description_es: 'Hamburguesas artesanales hechas frescas diariamente',
      isActive: true,
      sortOrder: 0,
    },
  });

  // ─── Items ────────────────────────────────────────────────
  await prisma.item.upsert({
    where: { id: 'seed-item-1' },
    update: {},
    create: {
      id: 'seed-item-1',
      categoryId: category.id,
      tenantId: tenant.id,
      name_en: 'Classic Cheeseburger',
      name_es: 'Hamburguesa Clásica con Queso',
      description_en: 'Beef patty, cheddar, lettuce, tomato, house sauce',
      description_es: 'Carne de res, cheddar, lechuga, tomate, salsa de la casa',
      price: 12.99,
      currency: 'USD',
      allergens: ['gluten', 'dairy', 'eggs'],
      badges: ['popular'],
      isFeatured: true,
      spicyLevel: 0,
      status: ItemStatus.PUBLISHED,
      publishedAt: new Date(),
      sortOrder: 0,
    },
  });

  await prisma.item.upsert({
    where: { id: 'seed-item-2' },
    update: {},
    create: {
      id: 'seed-item-2',
      categoryId: category.id,
      tenantId: tenant.id,
      name_en: 'Spicy Jalapeño Burger',
      name_es: 'Hamburguesa Picante de Jalapeño',
      description_en: 'Beef patty, pepper jack, jalapeños, chipotle mayo',
      description_es: 'Carne de res, queso pepper jack, jalapeños, mayonesa chipotle',
      price: 14.99,
      currency: 'USD',
      allergens: ['gluten', 'dairy', 'eggs'],
      badges: ['spicy', 'new'],
      isFeatured: false,
      spicyLevel: 3,
      status: ItemStatus.PUBLISHED,
      publishedAt: new Date(),
      sortOrder: 1,
    },
  });

  console.log('✓ Menu, category, and items seeded');
  console.log('\n✅ Seed complete!');
  console.log('\nCredentials:');
  console.log('  Super Admin: superadmin@menu.digital / Admin1234!');
  console.log('  Owner:       owner@demo-restaurant.com / Owner1234!');
  console.log('  Tenant slug: demo-restaurant');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
