import { Role, POStatus, ChallanStatus, PaymentStatus, FollowupType, FollowupStatus, CustomerType, CustomerStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import prisma from './db';

export async function seedDatabase() {
  console.log('[Auto-Seed] Clearing existing data if any...');
  await prisma.followup.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.salesChallanItem.deleteMany();
  await prisma.salesChallan.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  console.log('[Auto-Seed] Seeding default multi-role accounts...');

  const adminPassword = await bcrypt.hash('AdminPass123!', 10);
  const salesPassword = await bcrypt.hash('SalesPass123!', 10);
  const warehousePassword = await bcrypt.hash('WarehousePass123!', 10);
  const accountsPassword = await bcrypt.hash('AccountsPass123!', 10);

  // 1. Users
  await prisma.user.create({
    data: {
      email: 'admin@company.com',
      name: 'Eleanor Vance (Admin)',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  const salesUser1 = await prisma.user.create({
    data: {
      email: 'sales@company.com',
      name: 'Marcus Brody (Senior Sales)',
      password: salesPassword,
      role: Role.SALES,
    },
  });

  const salesUser2 = await prisma.user.create({
    data: {
      email: 'sales2@company.com',
      name: 'Sarah Jenkins (Sales Exec)',
      password: salesPassword,
      role: Role.SALES,
    },
  });

  const warehouseUser = await prisma.user.create({
    data: {
      email: 'warehouse@company.com',
      name: 'Dave Miller (Warehouse Mgr)',
      password: warehousePassword,
      role: Role.WAREHOUSE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'accounts@company.com',
      name: 'Rachel Green (Lead Accountant)',
      password: accountsPassword,
      role: Role.ACCOUNTS,
    },
  });

  // 2. Customers
  const customer1 = await prisma.customer.create({
    data: {
      name: 'John Doe',
      companyName: 'Acme Enterprises',
      phone: '+1 555-0199',
      email: 'john@acme.com',
      billingAddress: '100 Innovation Way, Suite 400, Tech City, CA',
      shippingAddress: '100 Innovation Way, Dock 2, Tech City, CA',
      gstin: '22AAAAA0000A1Z5',
      notes: 'Key distributor for IT peripherals. Prefers net 30 payment terms.',
      customerType: CustomerType.DISTRIBUTOR,
      status: CustomerStatus.ACTIVE,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Jane Smith',
      companyName: 'Apex Retailers',
      phone: '+1 555-0230',
      email: 'jane@apexretail.com',
      billingAddress: '456 Commercial Blvd, Trade Town, NY',
      shippingAddress: '456 Commercial Blvd, Trade Town, NY',
      gstin: '27BBBBB1111B2Z6',
      notes: 'Fast growing chain. Requires expedited shipping for promotional events.',
      customerType: CustomerType.WHOLESALE,
      status: CustomerStatus.ACTIVE,
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: 'Robert Vance',
      companyName: 'Nexus Systems',
      phone: '+1 555-0842',
      email: 'rvance@nexussys.com',
      billingAddress: '789 Enterprise Road, Austin, TX',
      shippingAddress: '789 Enterprise Road, Austin, TX',
      gstin: '33CCCCC2222C3Z7',
      notes: 'High-volume buyer. Potential quarterly contract renewal in Q3.',
      customerType: CustomerType.DISTRIBUTOR,
      status: CustomerStatus.ACTIVE,
    },
  });

  const customer4 = await prisma.customer.create({
    data: {
      name: 'Samantha Reed',
      companyName: 'Horizon Creative Studio',
      phone: '+1 555-0911',
      email: 'sam@horizoncreative.io',
      billingAddress: '12 Art Center Plaza, Seattle, WA',
      shippingAddress: '12 Art Center Plaza, Seattle, WA',
      notes: 'New lead from tech expo. Interested in ergonomic furniture.',
      customerType: CustomerType.RETAIL,
      status: CustomerStatus.LEAD,
    },
  });

  // 3. Products
  const product1 = await prisma.product.create({
    data: {
      sku: 'SKU-ELEC-001',
      name: 'Wireless Ergonomic Mouse',
      category: 'Electronics',
      unit: 'pcs',
      price: 35.0,
      reorderLevel: 20,
      currentStock: 120,
      location: 'Aisle 3 - Shelf B1',
    },
  });

  const product2 = await prisma.product.create({
    data: {
      sku: 'SKU-FURN-002',
      name: 'Executive Mesh Office Chair',
      category: 'Furniture',
      unit: 'pcs',
      price: 240.0,
      reorderLevel: 10,
      currentStock: 4,
      location: 'Aisle 1 - Bay 4',
    },
  });

  const product3 = await prisma.product.create({
    data: {
      sku: 'SKU-PACK-003',
      name: 'Heavy Duty Shipping Tape (Box of 24)',
      category: 'Packaging',
      unit: 'box',
      price: 18.5,
      reorderLevel: 30,
      currentStock: 85,
      location: 'Aisle 5 - Pallet 12',
    },
  });

  const product4 = await prisma.product.create({
    data: {
      sku: 'SKU-ELEC-004',
      name: 'UltraWide 34" Curved Monitor',
      category: 'Electronics',
      unit: 'pcs',
      price: 499.0,
      reorderLevel: 8,
      currentStock: 25,
      location: 'Security Locker B',
    },
  });

  const product5 = await prisma.product.create({
    data: {
      sku: 'SKU-ELEC-005',
      name: 'RGB Mechanical Keyboard',
      category: 'Electronics',
      unit: 'pcs',
      price: 89.0,
      reorderLevel: 15,
      currentStock: 7,
      location: 'Aisle 3 - Shelf A4',
    },
  });

  // 4. Stock Movements
  await prisma.stockMovement.createMany({
    data: [
      { productId: product1.id, quantity: 150, type: 'IN', notes: 'Initial inventory intake', createdById: warehouseUser.id },
      { productId: product1.id, quantity: -30, type: 'OUT', referenceType: 'CHALLAN', notes: 'Dispatched for SCH-2026-001', createdById: warehouseUser.id },
      { productId: product2.id, quantity: 10, type: 'IN', notes: 'Received PO-2026-001', createdById: warehouseUser.id },
      { productId: product2.id, quantity: -6, type: 'OUT', referenceType: 'CHALLAN', notes: 'Dispatched for SCH-2026-002', createdById: warehouseUser.id },
      { productId: product3.id, quantity: 100, type: 'IN', notes: 'Initial stock load', createdById: warehouseUser.id },
      { productId: product3.id, quantity: -15, type: 'OUT', referenceType: 'CHALLAN', notes: 'Internal store use & dispatch', createdById: warehouseUser.id },
      { productId: product4.id, quantity: 30, type: 'IN', notes: 'Received shipment from LG Direct', createdById: warehouseUser.id },
      { productId: product4.id, quantity: -5, type: 'OUT', referenceType: 'CHALLAN', notes: 'Dispatched to Acme', createdById: warehouseUser.id },
    ],
  });

  // 5. Purchase Orders
  await prisma.purchaseOrder.create({
    data: {
      supplierName: 'Global Tech Distribution LLC',
      poDate: new Date('2026-07-15'),
      status: POStatus.RECEIVED,
      totalAmount: 4250.0,
      items: {
        create: [
          { productId: product1.id, quantity: 50, unitCost: 25.0 },
          { productId: product4.id, quantity: 6, unitCost: 350.0 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      supplierName: 'ErgoDesign Furnishings',
      poDate: new Date('2026-08-01'),
      status: POStatus.ORDERED,
      totalAmount: 3600.0,
      items: {
        create: [
          { productId: product2.id, quantity: 20, unitCost: 180.0 },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      supplierName: 'PackRight Solutions',
      poDate: new Date('2026-08-10'),
      status: POStatus.DRAFT,
      totalAmount: 925.0,
      items: {
        create: [
          { productId: product3.id, quantity: 50, unitCost: 12.0 },
          { productId: product5.id, quantity: 10, unitCost: 50.0 },
        ],
      },
    },
  });

  // 6. Sales Challans
  const challan1 = await prisma.salesChallan.create({
    data: {
      challanNumber: 'SCH-2026-001',
      customerId: customer1.id,
      createdById: salesUser1.id,
      challanDate: new Date('2026-08-02'),
      status: ChallanStatus.DELIVERED,
      totalQuantity: 25,
      items: {
        create: [
          { productId: product1.id, quantity: 20, unitPrice: 35.0, productName: product1.name, sku: product1.sku, unit: product1.unit },
          { productId: product4.id, quantity: 5, unitPrice: 499.0, productName: product4.name, sku: product4.sku, unit: product4.unit },
        ],
      },
    },
  });

  const challan2 = await prisma.salesChallan.create({
    data: {
      challanNumber: 'SCH-2026-002',
      customerId: customer2.id,
      createdById: salesUser2.id,
      challanDate: new Date('2026-08-05'),
      status: ChallanStatus.DISPATCHED,
      totalQuantity: 16,
      items: {
        create: [
          { productId: product2.id, quantity: 6, unitPrice: 240.0, productName: product2.name, sku: product2.sku, unit: product2.unit },
          { productId: product3.id, quantity: 10, unitPrice: 18.5, productName: product3.name, sku: product3.sku, unit: product3.unit },
        ],
      },
    },
  });

  const challan3 = await prisma.salesChallan.create({
    data: {
      challanNumber: 'SCH-2026-003',
      customerId: customer3.id,
      createdById: salesUser1.id,
      challanDate: new Date('2026-08-09'),
      status: ChallanStatus.CONFIRMED,
      totalQuantity: 10,
      items: {
        create: [
          { productId: product5.id, quantity: 10, unitPrice: 89.0, productName: product5.name, sku: product5.sku, unit: product5.unit },
        ],
      },
    },
  });

  await prisma.salesChallan.create({
    data: {
      challanNumber: 'SCH-2026-004',
      customerId: customer4.id,
      createdById: salesUser2.id,
      challanDate: new Date('2026-08-11'),
      status: ChallanStatus.DRAFT,
      totalQuantity: 2,
      items: {
        create: [
          { productId: product2.id, quantity: 2, unitPrice: 240.0, productName: product2.name, sku: product2.sku, unit: product2.unit },
        ],
      },
    },
  });

  // 7. Invoices
  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-001',
      customerId: customer1.id,
      challanId: challan1.id,
      subtotal: 3195.0,
      tax: 575.1,
      total: 3770.1,
      paymentStatus: PaymentStatus.PAID,
      dueDate: new Date('2026-08-30'),
      items: {
        create: [
          { productId: product1.id, quantity: 20, unitPrice: 35.0 },
          { productId: product4.id, quantity: 5, unitPrice: 499.0 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-002',
      customerId: customer2.id,
      challanId: challan2.id,
      subtotal: 1625.0,
      tax: 292.5,
      total: 1917.5,
      paymentStatus: PaymentStatus.PARTIAL,
      dueDate: new Date('2026-09-05'),
      items: {
        create: [
          { productId: product2.id, quantity: 6, unitPrice: 240.0 },
          { productId: product3.id, quantity: 10, unitPrice: 18.5 },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-003',
      customerId: customer3.id,
      challanId: challan3.id,
      subtotal: 890.0,
      tax: 160.2,
      total: 1050.2,
      paymentStatus: PaymentStatus.UNPAID,
      dueDate: new Date('2026-09-10'),
      items: {
        create: [
          { productId: product5.id, quantity: 10, unitPrice: 89.0 },
        ],
      },
    },
  });

  // 8. Follow-ups
  await prisma.followup.createMany({
    data: [
      {
        customerId: customer1.id,
        type: FollowupType.CALL,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: FollowupStatus.PENDING,
        notes: 'Confirm delivery satisfaction for SCH-2026-001 and discuss Q4 volume contract.',
        assignedToId: salesUser1.id,
      },
      {
        customerId: customer2.id,
        type: FollowupType.EMAIL,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: FollowupStatus.PENDING,
        notes: 'Remind accounts team regarding pending partial payment for INV-2026-002.',
        assignedToId: salesUser2.id,
      },
      {
        customerId: customer3.id,
        type: FollowupType.VISIT,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: FollowupStatus.PENDING,
        notes: 'On-site meeting at Nexus HQ to demonstrate new product lines.',
        assignedToId: salesUser1.id,
      },
      {
        customerId: customer4.id,
        type: FollowupType.CALL,
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        status: FollowupStatus.DONE,
        notes: 'Initial introduction call completed. Customer requested proposal for chairs.',
        assignedToId: salesUser2.id,
      },
    ],
  });

  console.log('[Auto-Seed] Successfully seeded all accounts and sample data!');
}
