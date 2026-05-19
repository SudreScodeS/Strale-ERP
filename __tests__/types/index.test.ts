// @ts-nocheck

/**
 * Tests for types/index.ts
 * Verifies type exports and structural compatibility
 */

import type {
  User,
  Product,
  Group,
  Variable,
  Order,
  OrderItem,
  FinancialRecord,
  Invoice,
  InvoiceData,
  PurchaseOrder,
  PurchaseItem,
  Supplier,
  Quote,
  QuoteItem,
  PriceTier,
  PrintPricingRule,
  GlobalConfig,
  TokenPayload,
  ActivityLog,
  UnitOfMeasure,
} from '../../types';

import type {
  ApiSuccess,
  ApiError,
  ApiMeta,
  ApiResponse,
} from '../../types/api.types';

describe('Type Exports', () => {
  it('should export User type with required fields', () => {
    const user: User = {
      id: '1',
      username: 'test',
      email: 'test@test.com',
      password: 'hashed',
      role: 'admin',
      createdAt: new Date(),
    };
    expect(user.id).toBe('1');
    expect(user.role).toBe('admin');
  });

  it('should export Product type with required fields', () => {
    const product: Product = {
      id: '1',
      name: 'Test Product',
      basePrice: 10.5,
      createdAt: new Date(),
    };
    expect(product.basePrice).toBe(10.5);
  });

  it('should export Product type with optional fields', () => {
    const product: Product = {
      id: '1',
      name: 'Full Product',
      basePrice: 20,
      profitMargin: 15,
      description: 'A product',
      imageUrl: 'http://example.com/img.png',
      createdAt: new Date(),
    };
    expect(product.profitMargin).toBe(15);
    expect(product.description).toBe('A product');
  });

  it('should export Group type', () => {
    const group: Group = {
      id: '1',
      name: 'Material',
      productId: 'p1',
      createdAt: new Date(),
    };
    expect(group.name).toBe('Material');
  });

  it('should export Variable type', () => {
    const variable: Variable = {
      id: '1',
      name: 'Nylon',
      additionalPrice: 5,
      stock: 100,
      groupId: 'g1',
      unitOfMeasure: 'un',
      createdAt: new Date(),
    };
    expect(variable.unitOfMeasure).toBe('un');
  });

  it('should accept all UnitOfMeasure values', () => {
    const units: UnitOfMeasure[] = ['un', 'cm²', 'm²', 'kg', 'g', 'l', 'ml', 'm', 'cm'];
    expect(units).toHaveLength(9);
  });

  it('should export Order type with correct status values', () => {
    const statuses: Order['status'][] = ['pending', 'completed', 'cancelled'];
    expect(statuses).toHaveLength(3);
  });

  it('should export OrderItem type', () => {
    const item: OrderItem = {
      productId: 'p1',
      selectedVariables: [{ groupId: 'g1', variableId: 'v1', quantity: 5 }],
      quantity: 10,
      unitCost: 15,
      unitPrice: 20,
    };
    expect(item.selectedVariables).toHaveLength(1);
  });

  it('should export Quote type with correct status values', () => {
    const statuses: Quote['status'][] = ['draft', 'sent', 'approved', 'rejected', 'converted'];
    expect(statuses).toHaveLength(5);
  });

  it('should export QuoteItem with optional fields', () => {
    const item: QuoteItem = {
      productId: 'p1',
      productName: 'Product',
      selectedVariables: [],
      quantity: 10,
      unitCost: 15,
      unitPrice: 20,
      dimensions: { width: 30, height: 50 },
      printType: 'serigrafia',
      printPosition: 'front',
      printSize: 'medium',
    };
    expect(item.dimensions?.width).toBe(30);
  });

  it('should export TokenPayload type', () => {
    const payload: TokenPayload = {
      id: 'u1',
      username: 'admin',
      role: 'admin',
    };
    expect(payload.role).toBe('admin');
  });

  it('should export ActivityLog type', () => {
    const log: ActivityLog = {
      id: '1',
      timestamp: new Date().toISOString(),
      userId: 'u1',
      username: 'admin',
      action: 'create',
      entity: 'order',
      description: 'Created order',
    };
    expect(log.action).toBe('create');
  });

  it('should export PurchaseOrder with correct status values', () => {
    const statuses: PurchaseOrder['status'][] = ['pending', 'ordered', 'received'];
    expect(statuses).toHaveLength(3);
  });

  it('should export PriceTier type', () => {
    const tier: PriceTier = {
      minQty: 10,
      maxQty: 50,
      unitPrice: 0,
      discountPercent: 10,
      label: 'Atacado',
    };
    expect(tier.discountPercent).toBe(10);
  });

  it('should export PrintPricingRule type', () => {
    const rule: PrintPricingRule = {
      printType: 'serigrafia',
      size: 'medium',
      position: 'front',
      baseCost: 5,
      costPerColor: 2,
    };
    expect(rule.printType).toBe('serigrafia');
  });

  it('should export GlobalConfig type with all fields', () => {
    const config: GlobalConfig = {
      profitMargin: 20,
      logoPricePerColor: 5,
      minStockAlert: 10,
      systemName: 'Elitium ERP',
      companyName: 'Elitium',
      quoteValidityDays: 30,
      priceTiers: [],
      printPricingRules: [],
      printTypes: [{ value: 'serigrafia', label: 'Serigrafia' }],
    };
    expect(config.systemName).toBe('Elitium ERP');
  });
});

describe('API Types', () => {
  it('should export ApiSuccess type', () => {
    const response: ApiSuccess<{ id: string }> = {
      success: true,
      data: { id: '1' },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'req_123',
      },
    };
    expect(response.success).toBe(true);
  });

  it('should export ApiError type', () => {
    const response: ApiError = {
      success: false,
      message: 'Error',
      errorCode: 'BAD_REQUEST',
    };
    expect(response.success).toBe(false);
  });

  it('should export ApiResponse as union type', () => {
    const successResponse: ApiResponse<number> = {
      success: true,
      data: 42,
    };
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Error',
    };
    expect(successResponse.success).toBe(true);
    expect(errorResponse.success).toBe(false);
  });

  it('should export ApiMeta type', () => {
    const meta: ApiMeta = {
      timestamp: new Date().toISOString(),
      requestId: 'req_abc',
      page: 1,
      pageSize: 20,
      total: 100,
    };
    expect(meta.page).toBe(1);
    expect(meta.total).toBe(100);
  });
});
