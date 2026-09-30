ALTER TABLE `company_profiles` ADD `state` text;--> statement-breakpoint
-- Fill in the state from locations written as "City, ST"
UPDATE `company_profiles` SET `state` = upper(substr(trim(`location`), -2)) WHERE `state` IS NULL AND trim(`location`) LIKE '%, __' AND upper(substr(trim(`location`), -2)) IN ('AK','AL','AR','AZ','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','PR','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY');
