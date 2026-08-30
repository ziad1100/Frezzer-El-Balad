import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { adminListUsers, deleteUser, updateUser } from '@/api/admin';
import { Card, CardContent, EmptyState, Skeleton } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { PageHeader, Pagination, SearchBox, TableWrap, Td, Th, ToggleSwitch } from '@/components/admin/primitives';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/admin/primitives';
import type { Role, User } from '@/types';

const roles: Role[] = ['admin', 'manager', 'employee', 'customer'];

export function AdminUsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<User | null>(null);

  const users = useQuery({
    queryKey: ['admin', 'users', { page, q: search, role }],
    queryFn: () => adminListUsers({ page, limit: 15, q: search, role }),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => updateUser(id, { role }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUser(id, { isActive }),
    onSuccess: () => {
      toast.success(t('admin.saved'));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      invalidate();
      setDeleting(null);
    },
  });

  return (
    <div>
      <PageHeader title={t('admin.nav.users')} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('admin.searchPlaceholder')} />
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="h-10 w-40">
          <option value="">{t('admin.allRoles')}</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>

      {users.isLoading ? (
        <Skeleton className="h-96" />
      ) : users.data && users.data.items.length > 0 ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>{t('admin.customer')}</Th>
                <Th>{t('admin.email')}</Th>
                <Th>{t('admin.role')}</Th>
                <Th>{t('admin.statusChange')}</Th>
                <Th className="text-end">{t('admin.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u._id} className="group transition-colors hover:bg-[var(--tw-hover)]">
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-bold text-brand-400">
                        {u.fullName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold tracking-tight text-[var(--tw-text)]">{u.fullName}</p>
                        <p dir="ltr" className="text-xs text-[var(--tw-text-muted)]">{u.phone}</p>
                      </div>
                    </div>
                  </Td>
                  <Td dir="ltr">
                    <span className="text-sm text-[var(--tw-text-muted)]">{u.email}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500" />
                      <Select
                        value={u.role}
                        onChange={(e) => roleMutation.mutate({ id: u._id, role: e.target.value as Role })}
                        className="h-9 w-36"
                        disabled={u.role === 'admin'}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </Td>
                  <Td>
                    <ToggleSwitch
                      checked={u.isActive}
                      disabled={u.role === 'admin'}
                      onChange={() => activeMutation.mutate({ id: u._id, isActive: !u.isActive })}
                    />
                  </Td>
                  <Td className="text-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                      disabled={u.role === 'admin'}
                      onClick={() => setDeleting(u)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={users.data.page} pages={users.data.pages} onPage={setPage} />
        </>
      ) : (
        <Card>
          <CardContent className="py-14">
            <EmptyState title={t('admin.emptyList')} hint={t('admin.emptyListHint')} />
          </CardContent>
        </Card>
      )}

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