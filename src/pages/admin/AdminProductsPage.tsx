import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  adminListCategories,
  adminListProducts,
  createProduct,
  deleteProduct,
  toggleProduct,
  updateProduct,
} from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  ConfirmDialog,
  ImageUpload,
  PageHeader,
  Pagination,
  SearchBox,
  TableWrap,
  Td,
  Th,
  ToggleSwitch,
} from '@/components/admin/primitives';
import type { Category, Product, ProductPayload } from '@/types';
import { formatPrice } from '@/lib/utils';

type ProductListItem = Omit<Product, 'category'> & {
  category: string | Pick<Category, '_id' | 'name' | 'nameEn'>;
};

interface SizeField {
  name: string;
  nameEn: string;
  price: string;
  isAvailable?: boolean;
}

interface ExtraField {
  name: string;
  nameEn: string;
  price: string;
}

interface ProductFormState {
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  images: string[];
  sizes: SizeField[];
  extras: ExtraField[];
  ingredients: string;
  ingredientsEn: string;
  tags: string;
  basePrice: string;
  discount: string;
  preparationTime: string;
  calories: string;
  isAvailable: boolean;
  isBestSeller: boolean;
  isOffer: boolean;
}

const defaultForm = (): ProductFormState => ({
  name: '',
  nameEn: '',
  description: '',
  descriptionEn: '',
  category: '',
  images: [],
  sizes: [],
  extras: [],
  ingredients: '',
  ingredientsEn: '',
  tags: '',
  basePrice: '',
  discount: '0',
  preparationTime: '20',
  calories: '',
  isAvailable: true,
  isBestSeller: false,
  isOffer: false,
});

const fromProduct = (p: ProductListItem): ProductFormState => ({
  name: p.name,
  nameEn: p.nameEn,
  description: p.description,
  descriptionEn: p.descriptionEn,
  category: typeof p.category === 'string' ? p.category : p.category._id,
  images: p.images ?? [],
  sizes: (p.sizes ?? []).map((s) => ({ name: s.name, nameEn: s.nameEn, price: String(s.price), isAvailable: s.isAvailable })),
  extras: (p.extras ?? []).map((e) => ({ name: e.name, nameEn: e.nameEn, price: String(e.price) })),
  ingredients: (p.ingredients ?? []).join(', '),
  ingredientsEn: (p.ingredientsEn ?? []).join(', '),
  tags: (p.tags ?? []).join(', '),
  basePrice: String(p.basePrice),
  discount: String(p.discount ?? 0),
  preparationTime: String(p.preparationTime ?? 20),
  calories: String(p.calories ?? ''),
  isAvailable: p.isAvailable,
  isBestSeller: p.isBestSeller,
  isOffer: p.isOffer,
});

export function AdminProductsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const products = useQuery({
    queryKey: ['admin', 'products', { page, q: search, availability, category }],
    queryFn: () => adminListProducts({ page, limit: 12, q: search, availability, category }),
  });
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminListCategories });

  const [editing, setEditing] = useState<ProductListItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProductFormState>(defaultForm());
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<ProductListItem | null>(null);

  const openCreate = (): void => {
    setEditing(null);
    setForm(defaultForm());
    setFormError('');
    setCreating(true);
  };

  const openEdit = (p: ProductListItem): void => {
    setEditing(p);
    setForm(fromProduct(p));
    setFormError('');
    setCreating(true);
  };

  const closeModal = (): void => {
    setCreating(false);
    setEditing(null);
  };

  const setField = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]): void => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: ProductPayload = {
        name: form.name.trim(),
        nameEn: form.nameEn.trim(),
        description: form.description.trim(),
        descriptionEn: form.descriptionEn.trim(),
        category: form.category,
        images: form.images,
        sizes: form.sizes.map((s) => ({ name: s.name, nameEn: s.nameEn, price: Number(s.price) || 0, isAvailable: s.isAvailable ?? true })),
        extras: form.extras.map((e) => ({ name: e.name, nameEn: e.nameEn, price: Number(e.price) || 0 })),
        ingredients: form.ingredients.split(',').map((s) => s.trim()).filter(Boolean),
        ingredientsEn: form.ingredientsEn.split(',').map((s) => s.trim()).filter(Boolean),
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        basePrice: Number(form.basePrice),
        discount: Number(form.discount),
        preparationTime: Number(form.preparationTime),
        calories: form.calories ? Number(form.calories) : undefined,
        isAvailable: form.isAvailable,
        isBestSeller: form.isBestSeller,
        isOffer: form.isOffer,
      };
      if (editing) {
        await updateProduct(editing._id, payload);
      } else {
        await createProduct(payload);
      }
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
      closeModal();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : t('admin.saveFailed');
      setFormError(msg);
    },
  });

  const handleSave = (): void => {
    if (!form.name.trim()) {
      setFormError(t('admin.nameRequired'));
      return;
    }
    const price = Number(form.basePrice);
    if (!Number.isFinite(price) || price < 0) {
      setFormError(t('admin.invalidPrice'));
      return;
    }
    const discount = Number(form.discount) || 0;
    if (discount < 0 || discount > 100) {
      setFormError(t('admin.invalidDiscount'));
      return;
    }
    setFormError('');
    saveMutation.mutate();
  };

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleProduct(id),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  const setSizeField = (idx: number, patch: Partial<SizeField>): void => {
    const next = [...form.sizes];
    next[idx] = { ...next[idx], ...patch };
    setField('sizes', next);
  };

  const setExtraField = (idx: number, patch: Partial<ExtraField>): void => {
    const next = [...form.extras];
    next[idx] = { ...next[idx], ...patch };
    setField('extras', next);
  };

  const sizeList = form.sizes ?? [];
  const extraList = form.extras ?? [];

  const sectionOptions = (categories.data ?? []).filter((c) => c.type === 'section');
  const subOptions = (categories.data ?? []).filter((c) => c.type === 'sub');

  return (
    <div>
      <PageHeader
        title={t('admin.nav.products')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('admin.searchPlaceholder')} />
        <Select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="h-10 w-48"
        >
          <option value="">{t('admin.allCategories')}</option>
          <optgroup label={t('admin.isSection')}>
            {sectionOptions.map((c) => (
              <option key={c._id} value={c._id}>
                {lang === 'ar' ? c.name : c.nameEn || c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('admin.isSub')}>
            {subOptions.map((c) => (
              <option key={c._id} value={c._id}>
                {lang === 'ar' ? c.name : c.nameEn || c.name}
              </option>
            ))}
          </optgroup>
        </Select>
        <Select
          value={availability}
          onChange={(e) => { setAvailability(e.target.value); setPage(1); }}
          className="h-10 w-40"
        >
          <option value="">{t('common.all')}</option>
          <option value="available">{t('admin.enabled')}</option>
          <option value="hidden">{t('admin.disabled')}</option>
        </Select>
      </div>

      {products.isLoading ? (
        <Skeleton className="h-96" />
      ) : products.data && products.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th />
                <Th>{t('admin.nameAr')}</Th>
                <Th>{t('admin.category')}</Th>
                <Th>{t('admin.basePrice')}</Th>
                <Th>{t('admin.discount')}</Th>
                <Th>{t('admin.available')}</Th>
                <Th className="text-end">{t('admin.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {(products.data.items as ProductListItem[]).map((p) => (
                <tr key={p._id} className="transition-colors hover:bg-night-800/40">
                  <Td>
                    {p.images && p.images[0] ? (
                      <img src={p.images[0]} alt="" className="h-12 w-12 rounded-xl border border-night-700 object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-night-700 bg-night-800 text-xs text-night-500">
                        —
                      </span>
                    )}
                  </Td>
                  <Td>
                    <p className="font-bold text-night-50">{p.name}</p>
                    {p.nameEn ? <p className="text-xs text-night-500">{p.nameEn}</p> : null}
                  </Td>
                  <Td>{typeof p.category === 'object' && p.category ? p.category.name : '—'}</Td>
                  <Td>{formatPrice(p.basePrice, lang)}</Td>
                  <Td>{p.discount ? `${p.discount}%` : '—'}</Td>
                  <Td>
                    <ToggleSwitch checked={p.isAvailable} onChange={() => toggleMutation.mutate(p._id)} disabled={toggleMutation.isPending} />
                  </Td>
                  <Td className="text-end">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={t('common.edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-500/10 hover:text-red-400" onClick={() => setDeleting(p)} aria-label={t('common.delete')}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={products.data.page} pages={products.data.pages} onPage={setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}

      <Modal open={creating} onClose={closeModal} title={editing ? t('common.edit') : t('common.add')} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-name">{t('admin.nameAr')}</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-nameen">{t('admin.nameEn')}</Label>
              <Input id="p-nameen" value={form.nameEn} onChange={(e) => setField('nameEn', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-cat">{t('admin.category')}</Label>
              <Select id="p-cat" value={form.category} onChange={(e) => setField('category', e.target.value)}>
                <option value="">—</option>
                <optgroup label={t('admin.isSection')}>
                  {sectionOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {lang === 'ar' ? c.name : c.nameEn || c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('admin.isSub')}>
                  {subOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {lang === 'ar' ? c.name : c.nameEn || c.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <div>
              <Label htmlFor="p-price">{t('admin.basePrice')}</Label>
              <Input id="p-price" type="number" min={0} value={form.basePrice} onChange={(e) => setField('basePrice', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="p-disc">{t('admin.discount')}</Label>
              <Input id="p-disc" type="number" min={0} max={100} value={form.discount} onChange={(e) => setField('discount', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-cal">{t('admin.calories')}</Label>
              <Input id="p-cal" type="number" min={0} value={form.calories} onChange={(e) => setField('calories', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-prep">{t('admin.prepTime')}</Label>
              <Input id="p-prep" type="number" min={0} value={form.preparationTime} onChange={(e) => setField('preparationTime', e.target.value)} />
            </div>
          </div>

          <ImageUpload value={form.images[0] ?? ''} label={t('admin.image')} onChange={(url) => setField('images', url ? [url] : [])} />

          <div>
            <Label>{t('admin.addSize')}</Label>
            {sizeList.length > 0 ? (
              <div className="space-y-2">
                {sizeList.map((size, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input
                      value={size.name}
                      onChange={(e) => setSizeField(idx, { name: e.target.value })}
                      placeholder={t('admin.sizeNameAr')}
                    />
                    <Input
                      value={size.nameEn}
                      onChange={(e) => setSizeField(idx, { nameEn: e.target.value })}
                      placeholder={t('admin.sizeNameEn')}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={size.price}
                        onChange={(e) => setSizeField(idx, { price: e.target.value })}
                        placeholder={t('admin.basePrice')}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-400"
                        onClick={() => setField('sizes', sizeList.filter((_, i) => i !== idx))}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-night-500">—</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setField('sizes', [...sizeList, { name: '', nameEn: '', price: '', isAvailable: true }])}
            >
              <Plus className="h-4 w-4" />
              {t('admin.addSize')}
            </Button>
          </div>

          <div>
            <Label>{t('admin.addExtra')}</Label>
            {extraList.length > 0 ? (
              <div className="space-y-2">
                {extraList.map((extra, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Input
                      value={extra.name}
                      onChange={(e) => setExtraField(idx, { name: e.target.value })}
                      placeholder={t('admin.extraNameAr')}
                    />
                    <Input
                      value={extra.nameEn}
                      onChange={(e) => setExtraField(idx, { nameEn: e.target.value })}
                      placeholder={t('admin.extraNameEn')}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={extra.price}
                        onChange={(e) => setExtraField(idx, { price: e.target.value })}
                        placeholder={t('admin.basePrice')}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-400"
                        onClick={() => setField('extras', extraList.filter((_, i) => i !== idx))}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-night-500">—</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setField('extras', [...extraList, { name: '', nameEn: '', price: '' }])}
            >
              <Plus className="h-4 w-4" />
              {t('admin.addExtra')}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-ing">{t('admin.ingredientsAr')}</Label>
              <Input id="p-ing" value={form.ingredients} onChange={(e) => setField('ingredients', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-ingen">{t('admin.ingredientsEn')}</Label>
              <Input id="p-ingen" value={form.ingredientsEn} onChange={(e) => setField('ingredientsEn', e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="p-tags">{t('admin.tags')}</Label>
            <Input id="p-tags" value={form.tags} onChange={(e) => setField('tags', e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="p-desc">{t('admin.descriptionAr')}</Label>
              <Textarea id="p-desc" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-descen">{t('admin.descriptionEn')}</Label>
              <Textarea id="p-descen" rows={3} value={form.descriptionEn} onChange={(e) => setField('descriptionEn', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ['available', form.isAvailable, (v: boolean) => setField('isAvailable', v)],
                ['bestSeller', form.isBestSeller, (v: boolean) => setField('isBestSeller', v)],
                ['isOffer', form.isOffer, (v: boolean) => setField('isOffer', v)],
              ] as const
            ).map(([labelKey, checked, setter]) => (
              <div key={labelKey} className="flex items-center justify-between rounded-xl border border-night-800 px-4 py-3">
                <span className="text-sm font-semibold text-night-200">{t(`admin.${labelKey}`)}</span>
                <ToggleSwitch checked={checked} onChange={() => setter(!checked)} />
              </div>
            ))}
          </div>

          {formError ? <p className="text-sm text-red-400">{formError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              {t('common.cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={handleSave}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting._id)}
        title={t('admin.confirmDeleteTitle')}
        message={t('admin.confirmDelete')}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}