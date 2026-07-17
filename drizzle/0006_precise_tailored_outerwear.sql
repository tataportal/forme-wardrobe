UPDATE `garments` SET `garment_type` = 'Coat'
WHERE `category` = 'Tailoring'
  AND (lower(`name`) LIKE '%coat%' OR lower(`name`) LIKE '%peacoat%' OR lower(`name`) LIKE '%trench%');
