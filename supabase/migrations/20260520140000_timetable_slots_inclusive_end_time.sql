-- Timetable slot end_time is stored as the inclusive last minute of the slot.
-- The API exposes endTime as the exclusive clock boundary (one minute later) so adjacent
-- periods (e.g. 09:00–10:00 then 10:00–11:00) do not overlap.
--
-- Legacy rows stored end_time as the same wall-clock value the user chose as the period end.
-- Subtract one minute once so stored values match the new convention.

update public.timetable_slots
set end_time = end_time - interval '1 minute';

comment on column public.timetable_slots.end_time is
  'Inclusive last minute of the slot; API maps to display end (+1 minute).';
