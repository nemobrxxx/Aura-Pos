/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  priceAtSale: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  timestamp: number;
  paymentMethod: 'cash' | 'card' | 'pix';
  discount: number;
}

export interface StoreConfig {
  name: string;
  subtitle: string;
  cnpj: string;
  address: string;
  phone: string;
  footerMessage: string;
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
