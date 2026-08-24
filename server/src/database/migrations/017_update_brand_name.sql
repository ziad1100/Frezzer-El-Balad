-- Update the restaurant name in settings to the new brand
UPDATE settings
SET value = '{"ar":"ولاد حلال","en":"Welad Halal"}'::jsonb
WHERE key = 'restaurantName';

-- Update the facebook field in settings
UPDATE settings
SET value = '"Welad Halal"'::jsonb
WHERE key = 'facebook';

-- Update branch name
UPDATE branches
SET "nameEn" = 'Welad Halal'
WHERE "nameEn" = 'Frezzer El Balad';

-- Update posts content that references the old brand
UPDATE posts
SET content = replace(content, 'فريزر البلد', 'ولاد حلال'),
    "contentEn" = replace("contentEn", 'Frezzer El Balad', 'Welad Halal')
WHERE content LIKE '%فريزر%' OR "contentEn" LIKE '%Frezzer%';
