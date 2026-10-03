-- Run in the Supabase SQL Editor to enable saved Zing profile photos.
alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('zing-avatars', 'zing-avatars', false, 2097152, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "Zing profile photos are viewable"
  on storage.objects for select to authenticated
  using (bucket_id = 'zing-avatars');

create policy "Members upload their own Zing profile photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'zing-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members update their own Zing profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'zing-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'zing-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members delete their own Zing profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'zing-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
