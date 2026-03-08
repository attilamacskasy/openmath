-- v2.6: Locale support for review templates
ALTER TABLE review_templates ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

-- Deduplicate existing templates before creating unique index
DELETE FROM review_templates a
  USING review_templates b
  WHERE a.id > b.id
    AND a.reviewer_role = b.reviewer_role
    AND a.locale = b.locale
    AND a.sort_order = b.sort_order;

-- Update unique constraint to include locale
-- (allows same label in different locales)
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_templates_role_locale_sort
  ON review_templates(reviewer_role, locale, sort_order);

-- Seed Hungarian teacher templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order, locale) VALUES
  ('teacher', 'positive', 'Kiváló munka',         'Kiváló munka! Nagyszerű megértést mutattál az anyagban. Így tovább!', 1, 'hu'),
  ('teacher', 'positive', 'Szép munka',            'Szép munka! Az erőfeszítésed meglátszik. Büszke vagyok a fejlődésedre.', 2, 'hu'),
  ('teacher', 'positive', 'Nagy fejlődés',         'Nagyszerű fejlődés az előző alkalom óta. Egyre jobban megy!', 3, 'hu'),
  ('teacher', 'neutral',  'Jó próbálkozás',        'Jó próbálkozás. Nézd át a hibásan megoldott feladatokat és próbáld újra, hogy javíts az eredményeden.', 4, 'hu'),
  ('teacher', 'neutral',  'Gyakorolj tovább',      'Gyakorolj tovább — jó úton haladsz, de több ismétlésre van szükség a magabiztossághoz.', 5, 'hu'),
  ('teacher', 'neutral',  'Van hova fejlődni',     'Szolid próbálkozás. Koncentrálj azokra a területekre, ahol hibáztál, és kérj segítséget, ha kell.', 6, 'hu'),
  ('teacher', 'negative', 'Több gyakorlás kell',   'Ez a téma még több gyakorlást igényel. Kérlek, nézd át az anyagot és próbáld újra.', 7, 'hu'),
  ('teacher', 'negative', 'Elvárt szint alatt',    'Az eredményed az elvárt szint alatt van. Dolgozzunk együtt, hogy kiderítsük, mi okoz nehézséget.', 8, 'hu'),
  ('teacher', 'negative', 'Próbáld újra',          'Túl sok hiba volt ebben a feladatsorban. Kérlek, próbáld újra, miután átnézted a helyes válaszokat.', 9, 'hu')
ON CONFLICT DO NOTHING;

-- Seed Hungarian parent templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order, locale) VALUES
  ('parent', 'positive', 'Nagyon büszke vagyok!',  'Nagyon büszke vagyok rád! A kemény munkád meghozta gyümölcsét. Fantasztikus eredmény!', 1, 'hu'),
  ('parent', 'positive', 'Csodás munka',           'Csodás munka! Nagyon jól teljesítettél ezen a kvízen. Ünnepeljünk!', 2, 'hu'),
  ('parent', 'positive', 'Ragyogj tovább',         'Fantasztikus erőfeszítés! Hihetetlen munkát végzel a matekgyakorlásoddal.', 3, 'hu'),
  ('parent', 'neutral',  'Jó próbálkozás',         'Jó próbálkozás! Nézzük át együtt azokat, amiket elhibáztál, és legközelebb még jobban fog menni.', 4, 'hu'),
  ('parent', 'neutral',  'Gyakorlás a mester',     'Nem rossz! Még egy kis gyakorlás és ott leszel. Szeretnéd újra megpróbálni együtt?', 5, 'hu'),
  ('parent', 'neutral',  'Majdnem sikerült',       'Közel vagy! Koncentráljunk a nehéz részekre és csináljunk még egy kört.', 6, 'hu'),
  ('parent', 'negative', 'Nézzük át együtt',       'Ez egy nehéz volt. Üljünk le együtt és nézzük át azokat a feladatokat, amiket nehéznek találtál.', 7, 'hu'),
  ('parent', 'negative', 'Több időt kell szánni',  'Az eredményed azt mutatja, hogy több időt kell szánnunk erre a témára. Gyakoroljunk együtt ezen a héten.', 8, 'hu'),
  ('parent', 'negative', 'Próbáld újra',           'Ne aggódj — mindenkinek vannak nehéz pillanatai. Nézzük át a válaszokat és próbáljuk újra.', 9, 'hu')
ON CONFLICT DO NOTHING;
