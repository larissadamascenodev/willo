-- Public bucket for the photos on challenge cards: one per kind of challenge, made once by the challenge-cover function (service role) and read by anyone.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-covers', 'challenge-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
