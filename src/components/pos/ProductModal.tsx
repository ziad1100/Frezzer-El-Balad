import { useState } from 'react';
import { Printer, Save, FileText } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: ProductData) => void;
}

interface ProductData {
  name: string;
  unit: string;
  barcode: string;
  supplierCode: string;
  price: number;
  type: 'inventory' | 'service' | 'raw' | 'assembled';
}

export function ProductModal({ isOpen, onClose, onSave }: ProductModalProps) {
  const [productType, setProductType] = useState<'inventory' | 'service' | 'raw' | 'assembled'>('inventory');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'units' | 'tax' | 'stock' | 'options'>('units');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      name,
      unit,
      barcode,
      supplierCode,
      price,
      type: productType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[600px] max-h-[80vh] bg-[#E9F0E3] rounded border border-gray-400 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-[#E9F0E3] border-b border-gray-300 px-4 py-2">
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-bold text-gray-800">بيانات صنف جديد</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-xs"
          >
            ✕
          </button>
        </div>

        {/* Product Type Radio */}
        <div className="flex items-center gap-4 bg-[#E9F0E3] border-b border-gray-300 px-4 py-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="radio"
              name="productType"
              checked={productType === 'inventory'}
              onChange={() => setProductType('inventory')}
              className="w-3 h-3"
            />
            صنف مخزوني
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="radio"
              name="productType"
              checked={productType === 'service'}
              onChange={() => setProductType('service')}
              className="w-3 h-3"
            />
            صنف خدمي
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="radio"
              name="productType"
              checked={productType === 'raw'}
              onChange={() => setProductType('raw')}
              className="w-3 h-3"
            />
            خامات
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="radio"
              name="productType"
              checked={productType === 'assembled'}
              onChange={() => setProductType('assembled')}
              className="w-3 h-3"
            />
            صنف مجمّع
          </label>
        </div>

        {/* Item Data Section */}
        <div className="p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-700">بيانات البند</h3>
          
          {/* Product Name - Green bar */}
          <div className="bg-[#1F5C3F] p-2 rounded">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الصنف"
              className="w-full px-3 py-2 bg-white border border-gray-300 text-sm font-bold"
            />
          </div>

          {/* Unit */}
          <div className="flex items-center gap-2">
            <label className="w-20 text-xs text-gray-600">الوحدة:</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="الوحدة"
              className="flex-1 px-3 py-1 bg-white border border-gray-300 text-xs"
            />
          </div>

          {/* Barcode - Special display */}
          <div className="flex items-center gap-2">
            <label className="w-20 text-xs text-gray-600">باركود:</label>
            <div className="flex-1 bg-[#12213A] p-3 rounded">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="6225000321137"
                className="w-full bg-transparent text-white font-mono text-lg text-center border-none focus:outline-none"
              />
            </div>
          </div>

          {/* Supplier Code */}
          <div className="flex items-center gap-2">
            <label className="w-20 text-xs text-gray-600">كود المورد:</label>
            <input
              type="text"
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
              placeholder="كود المورد"
              className="flex-1 px-3 py-1 bg-white border border-gray-300 text-xs"
            />
          </div>

          {/* Pricing Tabs */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="flex bg-[#E9F0E3] border-b border-gray-300">
              <button
                onClick={() => setActiveTab('units')}
                className={`px-3 py-1 text-xs ${
                  activeTab === 'units' ? 'bg-white border-b-2 border-[#1F5C3F]' : 'hover:bg-gray-200'
                }`}
              >
                وحدات القياس الفرعية
              </button>
              <button
                onClick={() => setActiveTab('tax')}
                className={`px-3 py-1 text-xs ${
                  activeTab === 'tax' ? 'bg-white border-b-2 border-[#1F5C3F]' : 'hover:bg-gray-200'
                }`}
              >
                إعدادات ضريبة
              </button>
              <button
                onClick={() => setActiveTab('stock')}
                className={`px-3 py-1 text-xs ${
                  activeTab === 'stock' ? 'bg-white border-b-2 border-[#1F5C3F]' : 'hover:bg-gray-200'
                }`}
              >
                المخزون
              </button>
              <button
                onClick={() => setActiveTab('options')}
                className={`px-3 py-1 text-xs ${
                  activeTab === 'options' ? 'bg-white border-b-2 border-[#1F5C3F]' : 'hover:bg-gray-200'
                }`}
              >
                خيارات
              </button>
            </div>

            <div className="p-3 bg-white">
              {activeTab === 'units' && (
                <div className="flex items-center gap-2">
                  <label className="w-20 text-xs text-gray-600">قطاعي:</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="w-32 px-3 py-1 bg-white border border-gray-300 text-xs"
                  />
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" className="w-3 h-3" />
                    تعديل
                  </label>
                </div>
              )}
              {activeTab === 'tax' && (
                <p className="text-xs text-gray-500">إعدادات الضريبة</p>
              )}
              {activeTab === 'stock' && (
                <p className="text-xs text-gray-500">إعدادات المخزون</p>
              )}
              {activeTab === 'options' && (
                <p className="text-xs text-gray-500">خيارات إضافية</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 bg-[#E9F0E3] border-t border-gray-300 px-4 py-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-4 py-2 bg-[#1F5C3F] text-white text-xs font-bold rounded hover:bg-[#174a32] transition-colors"
          >
            <Save className="h-3 w-3" />
            حفظ
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-4 py-2 bg-[#e6e4dc] text-gray-700 text-xs font-medium rounded border border-gray-300 hover:bg-gray-200 transition-colors"
          >
            <FileText className="h-3 w-3" />
            بدون طباعة
          </button>
        </div>
      </div>
    </div>
  );
}
