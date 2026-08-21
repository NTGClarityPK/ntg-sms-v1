-- Enable Supabase Realtime for messaging tables.
-- Run this AFTER create_messaging_tables_conversations_messages.
-- If you already added these tables to the publication (e.g. via Dashboard or execute_sql),
-- run only the REPLICA IDENTITY line and skip the ALTER PUBLICATION lines (they will error).

ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

-- Full replica identity so UPDATE events on message_reads (e.g. read_at) send the full row.
ALTER TABLE message_reads REPLICA IDENTITY FULL;
