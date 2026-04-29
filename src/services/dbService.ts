/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';
import { Product, Sale, StoreConfig } from '../types';

const DB_NAME = 'aura_pos_db';
const DB_VERSION = 2; // Increment version

class DatabaseService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Products Store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('sku', 'sku', { unique: true });
          productStore.createIndex('name', 'name', { unique: false });
        }

        // Sales Store
        if (!db.objectStoreNames.contains('sales')) {
          const saleStore = db.createObjectStore('sales', { keyPath: 'id' });
          saleStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }

  // --- Settings ---

  async getStoreConfig(): Promise<StoreConfig> {
    const db = await this.db;
    const config = await db.get('settings', 'store_config');
    return config || {
      name: 'Aura POS',
      subtitle: 'Variedades & Cia',
      cnpj: '00.000.000/0001-00',
      address: 'Rua Principal, 123',
      phone: '5511999999999',
      footerMessage: 'Obrigado pela preferência!'
    };
  }

  async saveStoreConfig(config: StoreConfig): Promise<void> {
    const db = await this.db;
    await db.put('settings', config, 'store_config');
  }

  // --- Products ---

  async getProducts(): Promise<Product[]> {
    const db = await this.db;
    return db.getAll('products');
  }

  async saveProduct(product: Product): Promise<void> {
    const db = await this.db;
    await db.put('products', {
      ...product,
      updatedAt: Date.now(),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    const db = await this.db;
    await db.delete('products', id);
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const db = await this.db;
    return db.getFromIndex('products', 'sku', sku);
  }

  // --- Sales ---

  async getSales(): Promise<Sale[]> {
    const db = await this.db;
    return db.getAll('sales');
  }

  async saveSale(sale: Sale): Promise<void> {
    const db = await this.db;
    const tx = db.transaction(['sales', 'products'], 'readwrite');
    
    // 1. Record the sale
    await tx.objectStore('sales').add(sale);

    // 2. Update stock
    for (const item of sale.items) {
      const product = await tx.objectStore('products').get(item.productId);
      if (product) {
        product.stock -= item.quantity;
        product.updatedAt = Date.now();
        await tx.objectStore('products').put(product);
      }
    }

    await tx.done;
  }
}

export const dbService = new DatabaseService();
