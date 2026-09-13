-- plan.md Item 16 Step E: manual campaign editor gate.
-- Single shared boolean, settable by either the business owner (self-serve
-- "حالت حرفه‌ای" / Professional Mode toggle in Settings) or review_admin (on
-- the business's behalf) -- see plan.md's 2026-09-13 decision. review_admin's
-- own access to the manual editor is unconditional regardless of this flag;
-- it only gates whether a given business owner's own UI shows the toggle/editor.
ALTER TABLE businesses ADD COLUMN manual_editor_enabled INTEGER NOT NULL DEFAULT 0;
