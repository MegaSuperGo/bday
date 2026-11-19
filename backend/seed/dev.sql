-- LOCAL DEVELOPMENT ONLY. Never run against the remote database.
-- Clearly fake names so they can't be mistaken for real guests.
INSERT OR IGNORE INTO guests (first_name, name_key) VALUES ('Testagent', 'testagent');
INSERT OR IGNORE INTO guests (first_name, name_key) VALUES ('Demo', 'demo');
