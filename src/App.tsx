/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Package, 
  History, 
  Plus, 
  Search, 
  ChevronRight,
  ArrowLeft,
  Printer,
  Trash2,
  Settings,
  Store,
  Menu,
  X,
  Share2,
  Send,
  Save,
  CheckCircle2,
  FileDown,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { dbService, auth } from './services/dbService';
import { Product, Sale, SaleItem, StoreConfig } from './types';
import { cn, formatCurrency, formatDate, generateId } from './lib/utils';

// --- Sub-components will be defined here or imported ---

type View = 'pos' | 'inventory' | 'history' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadData();
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const config = await dbService.getStoreConfig();
      setStoreConfig(config);

      const p = await dbService.getProducts();
      const s = await dbService.getSales();
      
      setProducts(p);
      setSales(s);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setProducts([]);
      setSales([]);
      setCart([]);
      setStoreConfig(null);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando Sistema Aura...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-2xl border border-slate-200 max-w-md w-full text-center"
        >
          <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl rotate-3">
            <Store className="w-12 h-12 text-white -rotate-3" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Aura POS</h1>
          <p className="text-slate-500 mb-10 text-sm">Sua gestão de vendas e estoque em qualquer lugar. Entre para sincronizar seus dados na nuvem.</p>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-4 hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
          >
            <LogIn size={20} /> Entrar com Google
          </button>
          
          <p className="mt-8 text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-relaxed">
            Desenvolvido por Aura Tech <br/> &copy; 2026 Todos os direitos reservados
          </p>
        </motion.div>
      </div>
    );
  }

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.priceAtSale }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        priceAtSale: product.price,
        subtotal: product.price
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => setCart([]);

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (!existing) return prev;
      
      const newQuantity = existing.quantity + delta;
      
      if (newQuantity <= 0) {
        return prev.filter(item => item.productId !== productId);
      }
      
      const product = products.find(p => p.id === productId);
      if (product && newQuantity > product.stock) return prev;
      
      return prev.map(item => 
        item.productId === productId 
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.priceAtSale }
          : item
      );
    });
  };

  const completeSale = async (paymentMethod: Sale['paymentMethod']) => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const newSale: Sale = {
      id: generateId(),
      items: [...cart],
      total,
      timestamp: Date.now(),
      paymentMethod,
      discount: 0
    };

    await dbService.saveSale(newSale);
    await loadData();
    setCart([]);
    setLastCompletedSale(newSale);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col overflow-hidden">
      {/* Header - Geometric Balance Style */}
      <header className="bg-indigo-700 text-white p-4 flex justify-between items-center shadow-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <Store className="w-6 h-6 text-indigo-700" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase">
            {storeConfig?.name || 'Aura POS'} <span className="text-indigo-200 font-normal">| {storeConfig?.subtitle || 'Loja Matriz'}</span>
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-3 bg-indigo-800/50 px-4 py-2 rounded-xl border border-indigo-500/30">
            <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center text-white font-bold shadow-inner">
              {user.displayName?.charAt(0) || <UserIcon size={16} />}
            </div>
            <div className="text-left">
              <p className="text-[9px] text-indigo-300 uppercase tracking-widest font-black leading-tight">Operador</p>
              <p className="text-xs font-bold text-white truncate max-w-[100px]">{user.displayName || user.email}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="ml-2 p-2 hover:bg-red-500 rounded-lg transition-colors text-indigo-300 hover:text-white"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
          <div className="h-8 w-px bg-indigo-500/50"></div>
          <div className="text-right">
            <p className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">Status Sync</p>
            <p className="text-[10px] flex items-center justify-end gap-1 font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Online
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden relative">
        {/* Navigation Sidebar (Geometric Style) */}
        <section className="hidden md:flex md:w-[240px] flex-col gap-4">
          <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-sm flex flex-col gap-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Gerenciamento</h4>
            <div className="grid grid-cols-1 gap-2">
              <NavButton icon={ShoppingCart} active={currentView === 'pos'} onClick={() => setCurrentView('pos')} label="Vendas" />
              <NavButton icon={Package} active={currentView === 'inventory'} onClick={() => setCurrentView('inventory')} label="Estoque" />
              <NavButton icon={History} active={currentView === 'history'} onClick={() => setCurrentView('history')} label="Relatórios" />
              <NavButton icon={Settings} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} label="Ajustes" />
            </div>
          </div>
        </section>

        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {currentView === 'pos' && (
              <POSView 
                key="pos" 
                products={products} 
                onAddToCart={addToCart} 
                cart={cart}
                onRemoveFromCart={removeFromCart}
                onClearCart={clearCart}
                onCompleteSale={completeSale}
                updateCartQuantity={updateCartQuantity}
                lastCompletedSale={lastCompletedSale}
                setLastCompletedSale={setLastCompletedSale}
                storeConfig={storeConfig}
              />
            )}

            {currentView === 'inventory' && (
              <InventoryView 
                key="inventory" 
                products={products} 
                onRefresh={loadData}
              />
            )}

            {currentView === 'history' && (
              <SalesHistoryView 
                key="history" 
                sales={sales} 
              />
            )}

            {currentView === 'settings' && storeConfig && (
              <SettingsView 
                key="settings"
                config={storeConfig}
                onSave={async (newConfig) => {
                  await dbService.saveStoreConfig(newConfig);
                  setStoreConfig(newConfig);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-lg border border-slate-200/50 rounded-3xl shadow-2xl pl-[25px] pr-[24px] pt-0 pb-[5px] h-[57px] flex items-center gap-6 z-50">
        <NavIcon icon={ShoppingCart} active={currentView === 'pos'} onClick={() => setCurrentView('pos')} />
        <NavIcon icon={Package} active={currentView === 'inventory'} onClick={() => setCurrentView('inventory')} />
        <NavIcon icon={History} active={currentView === 'history'} onClick={() => setCurrentView('history')} />
        <NavIcon icon={Settings} active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
      </nav>
    </div>
  );
}

function NavButton({ icon: Icon, active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg text-xs font-semibold flex items-center gap-3 transition-all w-full",
        active ? "bg-indigo-500 text-white shadow-lg" : "bg-indigo-800/40 text-indigo-300 hover:bg-indigo-800 hover:text-white"
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
      {active && <ChevronRight size={14} className="ml-auto opacity-50" />}
    </button>
  );
}

function NavIcon({ icon: Icon, active, onClick, label }: { icon: any, active: boolean, onClick: () => void, label?: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200",
        active ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
      )}
    >
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      {label && <span className="text-[10px] mt-1 font-semibold md:hidden">{label}</span>}
      {active && (
        <motion.div 
          layoutId="nav-active" 
          className="absolute -right-2 md:right-auto md:-bottom-2 w-1.5 h-1.5 md:w-5 md:h-1 bg-indigo-600 rounded-full"
        />
      )}
    </button>
  );
}

// --- View Components ---

function POSView({ products, onAddToCart, cart, onRemoveFromCart, onClearCart, onCompleteSale, updateCartQuantity, lastCompletedSale, setLastCompletedSale, storeConfig }: any) {
  const [search, setSearch] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const filteredProducts = products.filter((p: Product) => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const total = cart.reduce((sum: number, item: any) => sum + item.subtotal, 0);

  const handleDownloadPDF = () => {
    if (!lastCompletedSale) return;

    const element = document.createElement('div');
    element.style.padding = '40px';
    element.style.fontFamily = 'monospace';
    element.style.color = '#000';
    element.style.backgroundColor = '#fff';

    const itemsHtml = lastCompletedSale.items.map(item => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
        <span style="flex: 1;">${item.quantity}x ${item.productName}</span>
        <span style="margin-left: 20px;">${formatCurrency(item.subtotal)}</span>
      </div>
    `).join('');

    element.innerHTML = `
      <div style="max-width: 400px; margin: 0 auto;">
        <div style="text-align:center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 24px; color: #4f46e5;">${storeConfig?.name || 'AURA POS'}</h1>
          <p style="margin: 5px 0; color: #666; font-size: 14px;">${storeConfig?.subtitle || ''}</p>
          <p style="margin: 5px 0; color: #999; font-size: 12px;">CNPJ: ${storeConfig?.cnpj || ''}</p>
        </div>
        
        <div style="margin-bottom: 20px; font-size: 12px; color: #333;">
          <p><strong>DATA:</strong> ${formatDate(lastCompletedSale.timestamp)}</p>
          <p><strong>PEDIDO:</strong> #${lastCompletedSale.id.toUpperCase()}</p>
          <p><strong>PAGAMENTO:</strong> ${lastCompletedSale.paymentMethod.toUpperCase()}</p>
        </div>

        <div style="margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; font-size: 12px;">
            <span>ITEM</span>
            <span>SUBTOTAL</span>
          </div>
          ${itemsHtml}
        </div>

        <div style="text-align: right; margin-top: 20px;">
          <p style="font-size: 14px; margin-bottom: 5px;">Subtotal: ${formatCurrency(lastCompletedSale.total)}</p>
          <h2 style="font-size: 24px; margin: 0; color: #000;">TOTAL: ${formatCurrency(lastCompletedSale.total)}</h2>
        </div>

        <div style="text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px dashed #ccc; font-size: 12px; color: #666;">
          <p>${storeConfig?.footerMessage || 'Obrigado pela preferência!'}</p>
          <p style="font-style: italic; margin-top: 5px;">${storeConfig?.address || ''}</p>
        </div>
      </div>
    `;

    const opt = {
      margin:       10,
      filename:     `recibo-${lastCompletedSale.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as any;

    html2pdf().set(opt).from(element).save();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden"
    >
      {/* Products Column (Inventory Selection) */}
      <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[calc(100vh-140px)]">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Inventário</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar SKU ou Nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredProducts.map((product: Product) => (
            <div 
              key={product.id}
              onClick={() => product.stock > 0 && onAddToCart(product)}
              className={cn(
                "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all",
                product.stock <= 0 ? "opacity-50 grayscale cursor-not-allowed" : "hover:bg-slate-50 border-transparent active:scale-[0.98]",
                cart.some((i: any) => i.productId === product.id) && "bg-indigo-50 border-indigo-100"
              )}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{product.name}</span>
                <span className="text-[10px] text-slate-500 uppercase font-mono tracking-tighter">SKU: {product.sku}</span>
              </div>
              <div className="text-right">
                <span className={cn("block font-bold text-sm", cart.some((i: any) => i.productId === product.id) ? "text-indigo-600" : "text-slate-800")}>
                  {formatCurrency(product.price)}
                </span>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-tighter",
                  product.stock > 10 ? "text-green-600" : "text-orange-600"
                )}>
                  Estoque: {product.stock}
                </span>
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="py-20 text-center text-slate-400">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-xs">Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Column */}
      <div className="lg:col-span-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[calc(100vh-140px)]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Carrinho de Vendas</h2>
          {cart.length > 0 && (
            <button onClick={onClearCart} className="text-[10px] text-red-500 font-bold hover:underline tracking-tighter uppercase">
              Limpar Tudo
            </button>
          )}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] text-slate-400 border-b border-slate-100 uppercase tracking-widest">
                <th className="pb-3 font-medium">Item</th>
                <th className="pb-3 font-medium text-center">Qtd</th>
                <th className="pb-3 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {cart.map((item: any) => (
                <tr key={item.productId} className="border-b border-slate-50 group hover:bg-slate-50/50">
                  <td className="py-3">
                    <span className="font-semibold text-slate-800 line-clamp-1">{item.productName}</span>
                    <p className="text-[9px] text-slate-400 font-mono italic uppercase">{formatCurrency(item.priceAtSale)} / un</p>
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => updateCartQuantity(item.productId, -1)}
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-90 text-xs"
                      > - </button>
                      <span className="font-bold w-4 text-center text-xs">{item.quantity}</span>
                      <button 
                        onClick={() => updateCartQuantity(item.productId, 1)}
                        className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-90 text-xs"
                      > + </button>
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 opacity-30">
              <ShoppingCart size={48} className="mb-4" />
              <p className="font-bold uppercase tracking-widest text-[10px]">Venda Vazia</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900 text-white rounded-t-3xl shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col">
              <span className="text-slate-500 uppercase text-[9px] tracking-widest font-bold mb-1">Total Geral</span>
              <span className="text-3xl font-bold font-mono tracking-tighter">{formatCurrency(total)}</span>
            </div>
            
            <button 
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:grayscale disabled:scale-100"
            >
              FINALIZAR <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Column */}
      <div className="hidden xl:flex xl:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex-col overflow-hidden h-[calc(100vh-140px)]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
            <Printer size={14} /> Preview Comprovante
          </h2>
        </div>
        <div className="flex-1 p-4 bg-slate-100 overflow-hidden relative">
          <div className="bg-white w-full h-full shadow-inner p-6 text-[10px] font-mono flex flex-col gap-1 overflow-hidden border border-slate-200">
            <div className="text-center border-b border-slate-200 pb-3 mb-3 uppercase font-bold text-[12px] tracking-tight">
              {storeConfig?.name || 'AURA POS'}
            </div>
            <div className="text-center text-[8px] -mt-2 mb-2 opacity-60">
              {storeConfig?.subtitle || 'Variedades & Cia'}
            </div>
            <div className="flex justify-between">
              <span>DATA:</span>
              <span>{formatDate(Date.now())}</span>
            </div>
            <div className="flex justify-between">
              <span>PEDIDO:</span>
              <span>#{generateId().toUpperCase()}</span>
            </div>
            <div className="border-t border-slate-100 mt-2 pt-2 uppercase font-black text-[8px] text-slate-400 tracking-widest">
              Cupom Fiscal Eletrônico
            </div>
            <div className="flex-1 overflow-y-auto py-2 space-y-1">
              {cart.map((item: any) => (
                <div key={item.productId} className="flex justify-between italic">
                  <span className="truncate max-w-[120px]">{item.quantity}x {item.productName.toUpperCase()}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              {cart.length === 0 && <div className="text-center py-10 opacity-20 italic">Aguardando itens...</div>}
            </div>
            <div className="border-t-2 border-double border-slate-300 mt-4 pt-2 flex justify-between font-bold text-[14px]">
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="text-center mt-6 text-slate-400 text-[8px]">
              {storeConfig?.footerMessage || 'Obrigado pela preferência!'}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-100 to-transparent"></div>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Impressão Automática Ativada</p>
        </div>
      </div>

      {/* Checkout Modal Overlay */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md bg-white rounded-t-3xl md:rounded-3xl p-8 z-[101] shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Finalizar Venda</h2>
                <button onClick={() => setIsCheckoutOpen(false)} className="bg-slate-100 p-2 rounded-full"><X size={20} /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-bold text-slate-500 mb-4 block">Forma de Pagamento</label>
                  <div className="grid grid-cols-3 gap-3">
                    <PaymentOption icon="💵" label="Dinheiro" onClick={() => { onCompleteSale('cash'); setIsCheckoutOpen(false); }} />
                    <PaymentOption icon="💳" label="Cartão" onClick={() => { onCompleteSale('card'); setIsCheckoutOpen(false); }} />
                    <PaymentOption icon="💠" label="PIX" onClick={() => { onCompleteSale('pix'); setIsCheckoutOpen(false); }} />
                  </div>
                </div>

                <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex justify-between items-center italic text-indigo-900">
                    <span className="font-semibold text-lg">Total a pagar</span>
                    <span className="font-black text-3xl">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal Overlay */}
      <AnimatePresence>
        {lastCompletedSale && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-indigo-950/80 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] h-fit bg-white rounded-3xl p-8 z-[201] shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Venda Concluída!</h2>
              <p className="text-slate-500 text-sm mb-8">Deseja salvar ou imprimir o comprovante?</p>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95"
                >
                  <FileDown size={20} /> Salvar como PDF
                </button>
                <button 
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if(printWindow) {
                         let itemsHtml = lastCompletedSale.items.map(item => `
                          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>${item.quantity}x ${item.productName}</span>
                            <span>${formatCurrency(item.subtotal)}</span>
                          </div>
                        `).join('');
                        printWindow.document.write(`
                          <html>
                            <body onload="window.print(); window.close();">
                              <div style="font-family: monospace; width: 80mm; padding: 10px;">
                                <h3 style="text-align:center">${storeConfig?.name || 'AURA POS'}</h3>
                                <p style="text-align:center">${storeConfig?.subtitle || ''}</p>
                                <hr/>
                                ${itemsHtml}
                                <hr/>
                                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                                  <span>TOTAL</span>
                                  <span>${formatCurrency(lastCompletedSale.total)}</span>
                                </div>
                                <hr/>
                                <div style="text-align:center; font-size:10px;">
                                  <p>${storeConfig?.footerMessage || ''}</p>
                                  <p>${storeConfig?.cnpj || ''}</p>
                                </div>
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                    }
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <Printer size={20} /> Imprimir Recibo
                </button>
                <button 
                  onClick={() => setLastCompletedSale(null)}
                  className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                >
                  Nova Venda
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PaymentOption({ icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all group"
    >
      <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-xs font-bold text-slate-600">{label}</span>
    </button>
  );
}

function InventoryView({ products, onRefresh }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);

  const handleSave = async (e: any) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const product: Product = {
      id: editingProduct?.id || generateId(),
      name: data.get('name') as string,
      sku: data.get('sku') as string,
      price: parseFloat(data.get('price') as string),
      stock: parseInt(data.get('stock') as string),
      category: data.get('category') as string,
      createdAt: editingProduct?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    await dbService.saveProduct(product);
    onRefresh();
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja excluir este produto?')) {
      await dbService.deleteProduct(id);
      onRefresh();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6 h-full overflow-hidden flex flex-col px-1"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Gestão de Inventário</h2>
          <p className="text-xs text-slate-500 italic">Controle total de produtos e níveis de estoque</p>
        </div>
        <button 
          onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>Cadastrar Produto</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="bg-slate-50/50 border-b border-slate-100 flex items-center font-bold text-slate-400 text-[10px] uppercase tracking-widest px-6 py-3">
          <div className="flex-1">Produto / Detalhes</div>
          <div className="w-32 text-center">SKU</div>
          <div className="w-32 text-center">Preço</div>
          <div className="w-32 text-center">Estoque</div>
          <div className="w-32 text-right">Ações</div>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {products.map((product: Product) => (
            <div key={product.id} className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{product.name}</p>
                <p className="text-xs text-slate-500 uppercase tracking-tighter">{product.category}</p>
              </div>
              <div className="w-32 text-center">
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-600">{product.sku}</span>
              </div>
              <div className="w-32 text-center font-bold text-slate-800">
                {formatCurrency(product.price)}
              </div>
              <div className="w-32 text-center">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                  product.stock > 10 ? "bg-green-100 text-green-700" : 
                  product.stock > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                )}>
                  {product.stock} un.
                </span>
              </div>
              <div className="w-32 text-right">
                <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                    className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  >
                    <Settings size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="py-20 text-center text-slate-300">
              <Package size={64} className="mx-auto mb-4 opacity-10" />
              <p>Nenhum produto cadastrado</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[500px] h-fit max-h-[90vh] bg-white rounded-3xl p-8 z-[70] shadow-2xl overflow-y-auto"
            >
              <h2 className="text-2xl font-extrabold mb-8">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
              
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-full">
                      <label className="block text-xs font-black uppercase text-slate-400 mb-2">Nome do Produto</label>
                      <input name="name" required defaultValue={editingProduct?.name} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-2">SKU / Código</label>
                      <input name="sku" required defaultValue={editingProduct?.sku} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-2">Categoria</label>
                      <input name="category" required defaultValue={editingProduct?.category} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-2">Preço (R$)</label>
                      <input name="price" type="number" step="0.01" required defaultValue={editingProduct?.price} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 mb-2">Estoque Inicial</label>
                      <input name="stock" type="number" required defaultValue={editingProduct?.stock} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar Produto</button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SalesHistoryView({ sales }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 h-full overflow-hidden flex flex-col"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Performance de Vendas</h2>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-lg border border-slate-200">
          <History size={14} className="text-indigo-600" />
          <span>Últimos 30 dias</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Transações" value={sales.length} icon="📈" subtitle="Vendas realizadas" shadowColor="shadow-indigo-100" />
        <StatCard label="Faturamento" value={formatCurrency(sales.reduce((sum: number, s: Sale) => sum + s.total, 0))} icon="💰" subtitle="Valor total bruto" shadowColor="shadow-green-100" />
        <StatCard label="Tickets" value={formatCurrency(sales.length ? sales.reduce((sum: number, s: Sale) => sum + s.total, 0) / sales.length : 0)} icon="📊" subtitle="Média por venda" shadowColor="shadow-purple-100" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fluxo de Caixa / Vendas Recentes</h2>
          <div className="flex gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500"></div>
             <div className="w-2 h-2 rounded-full bg-slate-200"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {sales.sort((a: Sale, b: Sale) => b.timestamp - a.timestamp).map((sale: Sale) => (
            <div key={sale.id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-lg shadow-sm border transition-transform group-hover:scale-105",
                  sale.paymentMethod === 'cash' ? "bg-green-50 border-green-100 text-green-700" :
                  sale.paymentMethod === 'card' ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-purple-50 border-purple-100 text-purple-700"
                )}>
                  {sale.paymentMethod === 'cash' ? '💵' : sale.paymentMethod === 'card' ? '💳' : '💠'}
                </div>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">Venda #{sale.id.toUpperCase()}</p>
                  <p className="text-[10px] text-slate-400 font-mono italic">{formatDate(sale.timestamp)} • {sale.items.length} itens</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900 tracking-tighter">{formatCurrency(sale.total)}</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded tracking-tighter">Finalizado</span>
                  <button className="text-slate-300 hover:text-indigo-600 transition-colors"><Printer size={12} /></button>
                </div>
              </div>
            </div>
          ))}

          {sales.length === 0 && (
            <div className="py-24 text-center text-slate-400 opacity-20">
              <History size={80} className="mx-auto mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs">Nenhum Registro Encontrado</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SettingsView({ config, onSave }: { config: StoreConfig, onSave: (c: StoreConfig) => Promise<void>, key?: string }) {
  const [formData, setFormData] = useState(config);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="max-w-2xl mx-auto py-8"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-indigo-700 p-8 text-white">
          <div className="flex items-center gap-4 mb-2">
            <Settings className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Configurações da Loja</h2>
          </div>
          <p className="text-indigo-100 text-sm">Personalize os dados que aparecem no seu recibo digital e impresso.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full">
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Nome Comercial</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600 transition-colors"
                placeholder="Ex: Aura POS Variedades"
              />
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Subtítulo / Slogan</label>
              <input 
                value={formData.subtitle}
                onChange={e => setFormData({ ...formData, subtitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600 transition-colors"
                placeholder="Ex: O melhor preço da região"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">CNPJ</label>
              <input 
                value={formData.cnpj}
                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600 transition-colors"
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">WhatsApp / Telefone</label>
              <input 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600 transition-colors"
                placeholder="5511999999999"
              />
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Endereço</label>
              <input 
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600 transition-colors"
                placeholder="Rua das Flores, 123 - Centro"
              />
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-black uppercase text-slate-400 mb-2">Mensagem do Rodapé</label>
              <textarea 
                value={formData.footerMessage}
                onChange={e => setFormData({ ...formData, footerMessage: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-600 transition-colors h-24 resize-none"
                placeholder="Obrigado pela preferência! Volte sempre."
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            {showSuccess && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-green-600 font-bold text-sm flex items-center gap-2"
              >
                <CheckCircle2 size={16} /> Configurações salvas!
              </motion.span>
            )}
            <button 
              type="submit"
              disabled={isSaving}
              className="ml-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : <><Save size={20} /> Salvar Alterações</>}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, subtitle, shadowColor }: any) {
  return (
    <div className={cn("bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-lg", shadowColor)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-xl opacity-40">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        {subtitle && <p className="text-[10px] text-slate-400 font-medium italic mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
