import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListPosts, createPost, deletePost, updatePost } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, ImageUpload, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/admin/primitives';
import type { Post } from '@/types';

interface PostForm {
  title: string;
  titleEn: string;
  excerpt: string;
  excerptEn: string;
  content: string;
  contentEn: string;
  image: string;
  tags: string;
  isPublished: boolean;
}

const blank = (): PostForm => ({ title: '', titleEn: '', excerpt: '', excerptEn: '', content: '', contentEn: '', image: '', tags: '', isPublished: true });

const fromPost = (p: Post): PostForm => ({
  title: p.title,
  titleEn: p.titleEn,
  excerpt: p.excerpt,
  excerptEn: p.excerptEn,
  content: p.content,
  contentEn: p.contentEn,
  image: p.image,
  tags: (p.tags ?? []).join(', '),
  isPublished: p.isPublished,
});

export function AdminPostsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState<PostForm>(blank());
  const [deleting, setDeleting] = useState<Post | null>(null);

  const posts = useQuery({
    queryKey: ['admin', 'posts', { page }],
    queryFn: () => adminListPosts({ page, limit: 15 }),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] });
    void queryClient.invalidateQueries({ queryKey: ['posts'] });
  };

  const openCreate = (): void => {
    setEditing(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (p: Post): void => {
    setEditing(p);
    setForm(fromPost(p));
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const payload: Partial<Post> = {
        title: form.title.trim(),
        titleEn: form.titleEn.trim(),
        excerpt: form.excerpt.trim(),
        excerptEn: form.excerptEn.trim(),
        content: form.content.trim(),
        contentEn: form.contentEn.trim(),
        image: form.image,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        isPublished: form.isPublished,
      };
      if (editing) await updatePost(editing._id, payload);
      else await createPost(payload);
    },
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: () => toast.error(t('admin.saveFailed')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  const fmt = (iso: string): string => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB');

  return (
    <div>
      <PageHeader
        title={t('admin.nav.posts')}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </Button>
        }
      />

      {posts.isLoading ? (
        <Skeleton className="h-96" />
      ) : posts.data && posts.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>{t('admin.titleAr')}</Th>
                <Th>{t('admin.image')}</Th>
                <Th>{t('admin.statusChange')}</Th>
                <Th>{t('admin.startDate')}</Th>
                <Th className="text-end">{t('admin.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {posts.data.items.map((p) => (
                <tr key={p._id} className="transition-colors hover:bg-night-800/40">
                  <Td>
                    <p className="flex items-center gap-2 font-bold text-night-50">
                      <FileText className="h-4 w-4 text-brand-500" />
                      {p.title}
                    </p>
                    {p.titleEn ? <p className="text-xs text-night-500">{p.titleEn}</p> : null}
                  </Td>
                  <Td>
                    {p.image ? (
                      <img src={p.image} alt="" className="h-10 w-14 rounded-lg border border-night-700 object-cover" />
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{p.isPublished ? t('admin.enabled') : t('admin.disabled')}</Td>
                  <Td>{fmt(p.publishedAt)}</Td>
                  <Td className="text-end">
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label={t('common.edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => setDeleting(p)}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={posts.data.page} pages={posts.data.pages} onPage={setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? t('common.edit') : t('common.add')} size="lg">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="post-title">{t('admin.titleAr')}</Label>
              <Input id="post-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="post-titleen">{t('admin.titleEn')}</Label>
              <Input id="post-titleen" value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
            </div>
          </div>

          <ImageUpload value={form.image} label={t('admin.image')} onChange={(url) => setForm({ ...form, image: url })} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="post-ex">{t('admin.descriptionAr')}</Label>
              <Textarea id="post-ex" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="post-exen">{t('admin.descriptionEn')}</Label>
              <Textarea id="post-exen" rows={2} value={form.excerptEn} onChange={(e) => setForm({ ...form, excerptEn: e.target.value })} />
            </div>
          </div>

          <div>
            <Label htmlFor="post-content">{t('admin.message')}</Label>
            <Textarea id="post-content" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="post-contenten">{t('admin.messageEn')}</Label>
            <Textarea id="post-contenten" rows={6} value={form.contentEn} onChange={(e) => setForm({ ...form, contentEn: e.target.value })} />
          </div>

          <div>
            <Label htmlFor="post-tags">{t('admin.tags')}</Label>
            <Input id="post-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-night-200">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            {t('admin.enabled')}
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
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