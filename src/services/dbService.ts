/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  runTransaction,
  serverTimestamp,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, Sale, StoreConfig } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
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
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class DatabaseService {
  // Check connection to Firestore
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }

  // --- Settings ---

  async getStoreConfig(): Promise<StoreConfig> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const path = `settings/${user.uid}`;
    try {
      const docSnap = await getDoc(doc(db, path));
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
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  }

  async saveStoreConfig(config: StoreConfig): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const path = `settings/${user.uid}`;
    try {
      await setDoc(doc(db, path), {
        ...config,
        ownerId: user.uid,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  // --- Products ---

  async getProducts(): Promise<Product[]> {
    const user = auth.currentUser;
    if (!user) return [];
    
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('ownerId', '==', user.uid), orderBy('name'));
    
    try {
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          // Convert Firestore Timestamp to number if necessary, or just keep as is if UI handles it
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : data.updatedAt
        };
      }) as Product[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
      return [];
    }
  }

  async saveProduct(product: Product): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const path = `products/${product.id}`;
    try {
      const isNew = !product.createdAt;
      await setDoc(doc(db, path), {
        ...product,
        ownerId: user.uid,
        createdAt: isNew ? serverTimestamp() : product.createdAt,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const path = `products/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const user = auth.currentUser;
    if (!user) return undefined;
    
    const q = query(collection(db, 'products'), where('ownerId', '==', user.uid), where('sku', '==', sku));
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return undefined;
      const docData = querySnapshot.docs[0];
      const data = docData.data();
      return { 
        ...data, 
        id: docData.id,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : data.updatedAt
      } as Product;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'products(sku)');
      return undefined;
    }
  }

  // --- Sales ---

  async getSales(): Promise<Sale[]> {
    const user = auth.currentUser;
    if (!user) return [];
    
    const salesRef = collection(db, 'sales');
    const q = query(salesRef, where('ownerId', '==', user.uid), orderBy('timestamp', 'desc'));
    
    try {
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : data.timestamp
        };
      }) as Sale[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'sales');
      return [];
    }
  }

  async saveSale(sale: Sale): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Record the sale
        const saleDoc = doc(collection(db, 'sales'), sale.id);
        transaction.set(saleDoc, {
          ...sale,
          ownerId: user.uid,
          timestamp: serverTimestamp()
        });

        // 2. Update stock
        for (const item of sale.items) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await transaction.get(productRef);
          
          if (productSnap.exists()) {
            const product = productSnap.data() as Product;
            transaction.update(productRef, {
              stock: product.stock - item.quantity,
              updatedAt: serverTimestamp()
            });
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales/transaction');
    }
  }
}

export const dbService = new DatabaseService();
dbService.testConnection();
