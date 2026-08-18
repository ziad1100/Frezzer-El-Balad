import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, MailOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListContacts, deleteContact, markContactRead } from '@/api/admin';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/admin/primitives';
import type { Contact } from '@/types';

export function AdminContactsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const contacts = useQuery({
    queryKey: ['admin', 'contacts', { page }],
    queryFn: () => adminListContacts({ page, limit: 20 }),
  });

  const [selected, setSelected] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'contacts'] });
  };

  const readMutation = useMutation({
    mutationFn: (id: string) => markContactRead(id),
    onSuccess: () => {
      toast.success(t('admin.markedRead'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  const fmt = (iso: string): string => new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB');

  return (
    <div>
      <PageHeader title={t('admin.nav.contacts')} />

      {contacts.isLoading ? (
        <Skeleton className="h-96" />
      ) : contacts.data && contacts.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>{t('admin.customer')}</Th>
                <Th>{t('admin.message')}</Th>
                <Th>{t('admin.phone')}</Th>
                <Th>{t('admin.startDate')}</Th>
                <Th>{t('admin.statusChange')}</Th>
              <Th className="text-end">{t('admin.actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {(contacts.data.items ?? []).map((c) => (
              <tr
                key={c._id}
                className={`transition-colors hover:bg-night-800/40 ${c.isRead ? 'opacity-60' : ''}`}
              >
                <Td>
                  <p className="font-bold text-night-50">{c.name}</p>
                  <p dir="ltr" className="text-xs text-night-500">{c.email}</p>
                </Td>
                <Td className="max-w-xs truncate">{c.message}</Td>
                <Td dir="ltr">{c.phone}</Td>
                <Td>{fmt(c.createdAt)}</Td>
                <Td>{c.isRead ? t('admin.markedRead') : t('admin.status.pending')}</Td>
                <Td className="text-end">
                  <div className="inline-flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setSelected(c)} aria-label={t('common.viewAll')}>
                      {c.isRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4 text-brand-500" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setDeleting(c)}
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
          <Pagination page={contacts.data.page} pages={contacts.data.pages} onPage={setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected ? (
          <div className="space-y-4">
            {!selected.isRead ? (
              <Button size="sm" variant="outline" loading={readMutation.isPending} onClick={() => readMutation.mutate(selected._id)}>
                <MailOpen className="h-4 w-4" />
                {t('admin.markedRead')}
              </Button>
            ) : null}
            <p className="text-sm text-night-400">
              <span dir="ltr">{selected.email}</span> · <span dir="ltr">{selected.phone}</span>
            </p>
            <p className="rounded-xl border border-night-800 bg-night-950 p-4 text-sm leading-relaxed text-night-200">
              {selected.message}
            </p>
            <p className="text-xs text-night-500">{fmt(selected.createdAt)}</p>
          </div>
        ) : null}
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