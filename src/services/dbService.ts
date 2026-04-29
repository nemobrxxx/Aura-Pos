/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  addDoc, 
  runTransaction,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Product, Sale, StoreConfig, OperationType } from '../types';

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class DatabaseService {
  private getUserPath() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return `users/${user.uid}`;
  }

  // --- Settings ---

  async getStoreConfig(): Promise<StoreConfig> {
    const path = `${this.getUserPath()}/config/main`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as StoreConfig;
      }
      
      return {
        name: 'Aura POS',
        subtitle: 'Variedades & Cia',
        cnpj: '00.000.000/0001-00',
        address: 'Rua Principal, 123',
        phone: '5511999999999',
        footerMessage: 'Obrigado pela preferência!'
      };
    } catch (error) {
      handleFirestoreError(error, 'get', path);
      return {} as StoreConfig; // Should not reach here
    }
  }

  async saveStoreConfig(config: StoreConfig): Promise<void> {
    const path = `${this.getUserPath()}/config/main`;
    try {
      const docRef = doc(db, path);
      await setDoc(docRef, config);
    } catch (error) {
      handleFirestoreError(error, 'write', path);
    }
  }

  // --- Products ---

  async getProducts(): Promise<Product[]> {
    const path = `${this.getUserPath()}/products`;
    try {
      const colRef = collection(db, path);
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    } catch (error) {
      handleFirestoreError(error, 'list', path);
      return [];
    }
  }

  async saveProduct(product: Product): Promise<void> {
    const path = `${this.getUserPath()}/products`;
    try {
      const docRef = doc(db, path, product.id);
      await setDoc(docRef, {
        ...product,
        updatedAt: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, 'write', `${path}/${product.id}`);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const path = `${this.getUserPath()}/products/${id}`;
    try {
      const docRef = doc(db, path);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, 'delete', path);
    }
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const path = `${this.getUserPath()}/products`;
    try {
      const colRef = collection(db, path);
      const q = query(colRef, where('sku', '==', sku));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return undefined;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Product;
    } catch (error) {
      handleFirestoreError(error, 'get', path);
      return undefined;
    }
  }

  // --- Sales ---

  async getSales(): Promise<Sale[]> {
    const path = `${this.getUserPath()}/sales`;
    try {
      const colRef = collection(db, path);
      const q = query(colRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
    } catch (error) {
      handleFirestoreError(error, 'list', path);
      return [];
    }
  }

  async saveSale(sale: Sale): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const salesPath = `users/${userId}/sales`;
    const productsPath = `users/${userId}/products`;

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Record the sale
        const saleRef = doc(collection(db, salesPath), sale.id);
        transaction.set(saleRef, sale);

        // 2. Update stock for each item
        for (const item of sale.items) {
          const productRef = doc(db, productsPath, item.productId);
          const productDoc = await transaction.get(productRef);
          
          if (productDoc.exists()) {
            const productData = productDoc.data() as Product;
            const newStock = productData.stock - item.quantity;
            transaction.update(productRef, {
              stock: newStock,
              updatedAt: Date.now()
            });
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, 'write', salesPath);
    }
  }
}

export const dbService = new DatabaseService();
