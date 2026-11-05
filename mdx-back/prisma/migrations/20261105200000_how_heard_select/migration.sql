UPDATE "form_fields"
SET "type" = 'SELECT',
    "options" = ARRAY['Instagram', 'Amigos', 'Escola', 'Outros']::TEXT[]
WHERE "label" = 'Como soube do evento';
