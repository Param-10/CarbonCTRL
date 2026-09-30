-- The "250-500" employee range left companies with 201-249 employees without
-- an option; it is now "201-500".
UPDATE `company_profiles` SET `employees` = '201-500' WHERE `employees` = '250-500';
