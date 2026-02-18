-- Create a public bucket for inventory/uniform images.
-- This enables backend uploads and public image URLs.

insert into storage.buckets (id, name, public)
values ('inventory-images', 'inventory-images', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

