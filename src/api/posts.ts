import { api, unwrap } from '@/lib/api';
import type { ApiEnvelope, Branch, Paginated, Post } from '@/types';

export const listPosts = (): Promise<Paginated<Post>> =>
  unwrap(api.get<ApiEnvelope<Paginated<Post>>>('/posts', { params: { published: true } }));

export const getPost = (slug: string): Promise<Post> =>
  unwrap(api.get<ApiEnvelope<Post>>(`/posts/${slug}`));

export const listBranches = (): Promise<Branch[]> =>
  unwrap(api.get<ApiEnvelope<Branch[]>>('/branches'));