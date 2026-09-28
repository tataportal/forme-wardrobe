ALTER TABLE `garment_canvas_preferences` ADD COLUMN `mobile_scale_multiplier` real CHECK (`mobile_scale_multiplier` IS NULL OR (`mobile_scale_multiplier` > 0 AND `mobile_scale_multiplier` <= 20));
ALTER TABLE `garment_canvas_preferences` ADD COLUMN `desktop_scale_multiplier` real CHECK (`desktop_scale_multiplier` IS NULL OR (`desktop_scale_multiplier` > 0 AND `desktop_scale_multiplier` <= 20));

-- Existing adjustments were created before a mobile-specific editor existed,
-- so retain them as desktop preferences and let mobile start from anatomy.
UPDATE `garment_canvas_preferences` SET `desktop_scale_multiplier` = `scale_multiplier`;
