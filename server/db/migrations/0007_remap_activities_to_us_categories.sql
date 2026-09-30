-- Move activities from the old IPCC-style sectors to the US business
-- categories in server/config/emissionFactors.js, converting amounts to
-- the new units (e.g. km -> miles, tonnes -> lbs). Generated from a
-- mapping table; each row is converted exactly once.
-- power/electricity-generation -> electricity/grid-electricity (kWh)
UPDATE `carbon_activities` SET `sector` = 'electricity', `subsector` = 'grid-electricity', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'kWh of electricity used (from your utility bill)' WHERE `sector` = 'power' AND `subsector` = 'electricity-generation';
--> statement-breakpoint
-- power/heat-plants -> heating_cooling/district-steam (kWh -> MMBtu)
UPDATE `carbon_activities` SET `sector` = 'heating_cooling', `subsector` = 'district-steam', `activity_amount` = `activity_amount` * 0.003412, `activity_unit` = 'MMBtu of purchased steam or heat' WHERE `sector` = 'power' AND `subsector` = 'heat-plants';
--> statement-breakpoint
-- power/solar-generation -> electricity/onsite-renewable (kWh)
UPDATE `carbon_activities` SET `sector` = 'electricity', `subsector` = 'onsite-renewable', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'kWh generated and used on site' WHERE `sector` = 'power' AND `subsector` = 'solar-generation';
--> statement-breakpoint
-- power/wind-generation -> electricity/onsite-renewable (kWh)
UPDATE `carbon_activities` SET `sector` = 'electricity', `subsector` = 'onsite-renewable', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'kWh generated and used on site' WHERE `sector` = 'power' AND `subsector` = 'wind-generation';
--> statement-breakpoint
-- power/hydroelectric -> electricity/onsite-renewable (kWh)
UPDATE `carbon_activities` SET `sector` = 'electricity', `subsector` = 'onsite-renewable', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'kWh generated and used on site' WHERE `sector` = 'power' AND `subsector` = 'hydroelectric';
--> statement-breakpoint
-- transportation/road -> vehicles/car-miles (km -> miles)
UPDATE `carbon_activities` SET `sector` = 'vehicles', `subsector` = 'car-miles', `activity_amount` = `activity_amount` * 0.621371, `activity_unit` = 'miles driven in company cars' WHERE `sector` = 'transportation' AND `subsector` = 'road';
--> statement-breakpoint
-- transportation/aviation -> business_travel/flight-medium-long (passenger-km -> passenger-miles)
UPDATE `carbon_activities` SET `sector` = 'business_travel', `subsector` = 'flight-medium-long', `activity_amount` = `activity_amount` * 0.621371, `activity_unit` = 'passenger-miles flown on flights over 300 miles' WHERE `sector` = 'transportation' AND `subsector` = 'aviation';
--> statement-breakpoint
-- transportation/shipping -> freight/ship (tonne-km -> short ton-miles)
UPDATE `carbon_activities` SET `sector` = 'freight', `subsector` = 'ship', `activity_amount` = `activity_amount` * 0.684944, `activity_unit` = 'short ton-miles shipped by water' WHERE `sector` = 'transportation' AND `subsector` = 'shipping';
--> statement-breakpoint
-- transportation/rail -> business_travel/rail-bus (passenger-km -> passenger-miles)
UPDATE `carbon_activities` SET `sector` = 'business_travel', `subsector` = 'rail-bus', `activity_amount` = `activity_amount` * 0.621371, `activity_unit` = 'passenger-miles by train or bus' WHERE `sector` = 'transportation' AND `subsector` = 'rail';
--> statement-breakpoint
-- transportation/public-transit -> commuting/transit (passenger-km -> passenger-miles)
UPDATE `carbon_activities` SET `sector` = 'commuting', `subsector` = 'transit', `activity_amount` = `activity_amount` * 0.621371, `activity_unit` = 'total passenger-miles employees rode transit' WHERE `sector` = 'transportation' AND `subsector` = 'public-transit';
--> statement-breakpoint
-- buildings/residential -> heating_cooling/facility-estimate (sq ft)
UPDATE `carbon_activities` SET `sector` = 'heating_cooling', `subsector` = 'facility-estimate', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'sq ft of floor space (per year; use only without bills)' WHERE `sector` = 'buildings' AND `subsector` = 'residential';
--> statement-breakpoint
-- buildings/commercial -> heating_cooling/facility-estimate (sq ft)
UPDATE `carbon_activities` SET `sector` = 'heating_cooling', `subsector` = 'facility-estimate', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'sq ft of floor space (per year; use only without bills)' WHERE `sector` = 'buildings' AND `subsector` = 'commercial';
--> statement-breakpoint
-- buildings/lighting -> electricity/grid-electricity (kWh)
UPDATE `carbon_activities` SET `sector` = 'electricity', `subsector` = 'grid-electricity', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'kWh of electricity used (from your utility bill)' WHERE `sector` = 'buildings' AND `subsector` = 'lighting';
--> statement-breakpoint
-- buildings/cooling -> electricity/grid-electricity (kWh)
UPDATE `carbon_activities` SET `sector` = 'electricity', `subsector` = 'grid-electricity', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'kWh of electricity used (from your utility bill)' WHERE `sector` = 'buildings' AND `subsector` = 'cooling';
--> statement-breakpoint
-- buildings/heating -> heating_cooling/natural-gas (kWh -> therms)
UPDATE `carbon_activities` SET `sector` = 'heating_cooling', `subsector` = 'natural-gas', `activity_amount` = `activity_amount` * 0.0341214, `activity_unit` = 'therms of natural gas (from your gas bill)' WHERE `sector` = 'buildings' AND `subsector` = 'heating';
--> statement-breakpoint
-- manufacturing/cement -> materials/cement (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'cement', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of cement' WHERE `sector` = 'manufacturing' AND `subsector` = 'cement';
--> statement-breakpoint
-- manufacturing/steel -> materials/steel (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'steel', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of steel' WHERE `sector` = 'manufacturing' AND `subsector` = 'steel';
--> statement-breakpoint
-- manufacturing/chemicals -> materials/chemicals (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'chemicals', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of chemicals' WHERE `sector` = 'manufacturing' AND `subsector` = 'chemicals';
--> statement-breakpoint
-- manufacturing/paper -> materials/paper (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'paper', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of paper' WHERE `sector` = 'manufacturing' AND `subsector` = 'paper';
--> statement-breakpoint
-- manufacturing/aluminum -> materials/aluminum (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'aluminum', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of aluminum (primary)' WHERE `sector` = 'manufacturing' AND `subsector` = 'aluminum';
--> statement-breakpoint
-- manufacturing/plastics -> materials/plastics (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'plastics', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of plastics' WHERE `sector` = 'manufacturing' AND `subsector` = 'plastics';
--> statement-breakpoint
-- manufacturing/electronics -> materials/electronics (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'materials', `subsector` = 'electronics', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of electronics' WHERE `sector` = 'manufacturing' AND `subsector` = 'electronics';
--> statement-breakpoint
-- waste/landfill -> waste/landfill (tonnes -> lbs)
UPDATE `carbon_activities` SET `sector` = 'waste', `subsector` = 'landfill', `activity_amount` = `activity_amount` * 2204.62, `activity_unit` = 'lbs of trash sent to landfill' WHERE `sector` = 'waste' AND `subsector` = 'landfill';
--> statement-breakpoint
-- waste/incineration -> waste/incineration (tonnes -> lbs)
UPDATE `carbon_activities` SET `sector` = 'waste', `subsector` = 'incineration', `activity_amount` = `activity_amount` * 2204.62, `activity_unit` = 'lbs of waste incinerated' WHERE `sector` = 'waste' AND `subsector` = 'incineration';
--> statement-breakpoint
-- waste/composting -> waste/composting (tonnes -> lbs)
UPDATE `carbon_activities` SET `sector` = 'waste', `subsector` = 'composting', `activity_amount` = `activity_amount` * 2204.62, `activity_unit` = 'lbs of waste composted' WHERE `sector` = 'waste' AND `subsector` = 'composting';
--> statement-breakpoint
-- waste/recycling -> waste/recycling (tonnes -> lbs)
UPDATE `carbon_activities` SET `sector` = 'waste', `subsector` = 'recycling', `activity_amount` = `activity_amount` * 2204.62, `activity_unit` = 'lbs of material recycled' WHERE `sector` = 'waste' AND `subsector` = 'recycling';
--> statement-breakpoint
-- waste/wastewater -> waste/wastewater (cubic meters -> gallons)
UPDATE `carbon_activities` SET `sector` = 'waste', `subsector` = 'wastewater', `activity_amount` = `activity_amount` * 264.172, `activity_unit` = 'gallons of wastewater treated' WHERE `sector` = 'waste' AND `subsector` = 'wastewater';
--> statement-breakpoint
-- agriculture/synthetic-fertilizer-application -> agriculture/synthetic-fertilizer (kg -> lbs)
UPDATE `carbon_activities` SET `sector` = 'agriculture', `subsector` = 'synthetic-fertilizer', `activity_amount` = `activity_amount` * 2.20462, `activity_unit` = 'lbs of synthetic fertilizer applied' WHERE `sector` = 'agriculture' AND `subsector` = 'synthetic-fertilizer-application';
--> statement-breakpoint
-- agriculture/manure-management -> agriculture/manure-management (head)
UPDATE `carbon_activities` SET `sector` = 'agriculture', `subsector` = 'manure-management', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'head of livestock (per year)' WHERE `sector` = 'agriculture' AND `subsector` = 'manure-management';
--> statement-breakpoint
-- agriculture/enteric-fermentation -> agriculture/cattle-enteric (head)
UPDATE `carbon_activities` SET `sector` = 'agriculture', `subsector` = 'cattle-enteric', `activity_amount` = `activity_amount` * 1, `activity_unit` = 'head of cattle (per year)' WHERE `sector` = 'agriculture' AND `subsector` = 'enteric-fermentation';
--> statement-breakpoint
-- agriculture/rice-cultivation -> agriculture/rice-cultivation (hectares -> acres)
UPDATE `carbon_activities` SET `sector` = 'agriculture', `subsector` = 'rice-cultivation', `activity_amount` = `activity_amount` * 2.47105, `activity_unit` = 'acres of rice (per season)' WHERE `sector` = 'agriculture' AND `subsector` = 'rice-cultivation';
--> statement-breakpoint
-- agriculture/crop-residues -> agriculture/crop-residues (tonnes -> short tons)
UPDATE `carbon_activities` SET `sector` = 'agriculture', `subsector` = 'crop-residues', `activity_amount` = `activity_amount` * 1.10231, `activity_unit` = 'short tons of crop residues' WHERE `sector` = 'agriculture' AND `subsector` = 'crop-residues';
--> statement-breakpoint
-- agriculture/cropland-fires -> agriculture/crop-burning (hectares -> acres)
UPDATE `carbon_activities` SET `sector` = 'agriculture', `subsector` = 'crop-burning', `activity_amount` = `activity_amount` * 2.47105, `activity_unit` = 'acres of residue burned' WHERE `sector` = 'agriculture' AND `subsector` = 'cropland-fires';
--> statement-breakpoint
-- Per-sector emission rows use the old sector names; they are rebuilt from
-- the activities on the next change (the score itself is always recomputed).
DELETE FROM `emissions`;
