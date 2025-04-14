import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Activity {
  id: string;
  sector: string;
  subsector: string;
  activity_amount: number;
  activity_unit: string;
}

interface CarbonScore {
  total_emissions_tons_co2e: number;
  emissions_breakdown: Record<string, number>;
  activity_details: Array<{
    sector: string;
    subsector: string;
    amount: number;
    emission_factor: number;
    emissions: number;
  }>;
  carbon_rating: string;
  rating_description: string;
  recommendations: string[];
}

interface CarbonState {
  activities: Activity[];
  carbonScore: CarbonScore | null;
  loading: boolean;
  initialized: boolean;
  addActivity: (activity: Omit<Activity, 'id'>, userId: string) => Promise<void>;
  removeActivity: (id: string, userId: string) => Promise<void>;
  calculateScore: (userId: string) => Promise<void>;
  resetScore: (userId: string) => Promise<void>;
  loadSavedData: (userId: string) => Promise<void>;
}

export const useCarbonStore = create<CarbonState>((set, get) => ({
  activities: [],
  carbonScore: null,
  loading: false,
  initialized: false,

  addActivity: async (activity, userId) => {
    if (!userId) {
      console.error('Cannot add activity: No user ID provided');
      return;
    }

    try {
      set({ loading: true });
      
      const id = crypto.randomUUID();
      
      // Get or create an assessment
      let assessmentId;
      
      // Check if there's an existing assessment
      const { data: existingAssessment, error: fetchError } = await supabase
        .from('carbon_assessments')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing assessment:', fetchError);
        throw fetchError;
      }
      
      if (existingAssessment) {
        assessmentId = existingAssessment.id;
        console.log('Using existing assessment ID:', assessmentId);
      } else {
        // Create a new assessment
        const { data: newAssessment, error: assessmentError } = await supabase
          .from('carbon_assessments')
          .insert({
            user_id: userId,
            total_emissions: 0,
            grade: 'N/A'
          })
          .select('id')
          .single();
        
        if (assessmentError) {
          console.error('Error creating new assessment:', assessmentError);
          throw assessmentError;
        }
        
        assessmentId = newAssessment.id;
        console.log('Created new assessment ID:', assessmentId);
      }
      
      // Save the activity to Supabase
      const { error: activityError } = await supabase
        .from('carbon_activities')
        .insert({
          id,
          assessment_id: assessmentId,
          sector: activity.sector,
          subsector: activity.subsector,
          activity_amount: activity.activity_amount,
          activity_unit: activity.activity_unit
        });
      
      if (activityError) {
        console.error('Error saving activity to Supabase:', activityError);
        throw activityError;
      }
      
      console.log('Successfully added activity to Supabase');
      
      // Update local state
      set(state => ({
        activities: [...state.activities, { ...activity, id }]
      }));
    } catch (error) {
      console.error('Error in addActivity:', error);
    } finally {
      set({ loading: false });
    }
  },

  removeActivity: async (id, userId) => {
    if (!userId) {
      console.error('Cannot remove activity: No user ID provided');
      return;
    }

    try {
      set({ loading: true });
      
      // Delete the activity from Supabase
      const { error } = await supabase
        .from('carbon_activities')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting activity from Supabase:', error);
        throw error;
      }
      
      console.log('Successfully removed activity from Supabase');
      
      // Update local state
      set(state => ({
        activities: state.activities.filter(activity => activity.id !== id)
      }));
      
      // Recalculate score after removing activity
      const { calculateScore } = get();
      await calculateScore(userId);
    } catch (error) {
      console.error('Error in removeActivity:', error);
    } finally {
      set({ loading: false });
    }
  },

  calculateScore: async (userId) => {
    const { activities } = get();
    
    if (!userId) {
      console.error('Cannot calculate score: No user ID provided');
      return;
    }
    
    if (activities.length === 0) {
      console.warn('No activities to calculate score for');
      return;
    }

    set({ loading: true });

    try {
      console.log('Calculating carbon score for user:', userId);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carbon-calculator`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_name: "User Company",
            activities: activities.map(({ sector, subsector, activity_amount, activity_unit }) => ({
              sector,
              subsector,
              activity_amount,
              activity_unit
            }))
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Carbon calculator API error:', errorText);
        throw new Error('Failed to calculate carbon score');
      }

      const result = await response.json();
      console.log('Received carbon score result:', result);
      
      set({ carbonScore: result });
      
      // Get the assessment ID
      const { data: assessment, error: assessmentFetchError } = await supabase
        .from('carbon_assessments')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (assessmentFetchError) {
        console.error('Error fetching assessment for update:', assessmentFetchError);
        throw assessmentFetchError;
      }
      
      if (assessment) {
        // Update the assessment with the new score
        const { error: updateError } = await supabase
          .from('carbon_assessments')
          .update({
            total_emissions: result.total_emissions_tons_co2e,
            grade: result.carbon_rating
          })
          .eq('id', assessment.id);
          
        if (updateError) {
          console.error('Error updating assessment with new score:', updateError);
          throw updateError;
        }
        
        console.log('Updated assessment with new score');
        
        // Delete existing emissions data
        const { error: deleteError } = await supabase
          .from('emissions')
          .delete()
          .eq('user_id', userId);
          
        if (deleteError) {
          console.error('Error deleting existing emissions data:', deleteError);
          throw deleteError;
        }
        
        // Insert new emissions data
        const emissionEntries = Object.entries(result.emissions_breakdown).map(([type, amount]) => ({
          user_id: userId,
          type,
          amount
        }));
        
        // Add a record for the total emissions as well
        emissionEntries.push({
          user_id: userId,
          type: 'total',
          amount: result.total_emissions_tons_co2e
        });
        
        const { error: insertError } = await supabase
          .from('emissions')
          .insert(emissionEntries);
          
        if (insertError) {
          console.error('Error inserting new emissions data:', insertError);
          throw insertError;
        }
        
        console.log('Successfully saved emissions data to Supabase');
      }
    } catch (error) {
      console.error('Error calculating carbon score:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  resetScore: async (userId) => {
    if (!userId) {
      console.error('Cannot reset score: No user ID provided');
      return;
    }

    try {
      set({ loading: true });
      
      console.log('Resetting carbon data for user:', userId);
      
      // Get all assessments for this user
      const { data: assessments, error: fetchError } = await supabase
        .from('carbon_assessments')
        .select('id')
        .eq('user_id', userId);
      
      if (fetchError) {
        console.error('Error fetching assessments for reset:', fetchError);
        throw fetchError;
      }
      
      if (assessments && assessments.length > 0) {
        const assessmentIds = assessments.map(a => a.id);
        
        // Delete activities for these assessments
        const { error: activitiesError } = await supabase
          .from('carbon_activities')
          .delete()
          .in('assessment_id', assessmentIds);
          
        if (activitiesError) {
          console.error('Error deleting activities during reset:', activitiesError);
          throw activitiesError;
        }
        
        // Delete the assessments
        const { error: assessmentsError } = await supabase
          .from('carbon_assessments')
          .delete()
          .in('id', assessmentIds);
          
        if (assessmentsError) {
          console.error('Error deleting assessments during reset:', assessmentsError);
          throw assessmentsError;
        }
      }
      
      // Delete emissions data
      const { error: emissionsError } = await supabase
        .from('emissions')
        .delete()
        .eq('user_id', userId);
        
      if (emissionsError) {
        console.error('Error deleting emissions during reset:', emissionsError);
        throw emissionsError;
      }
      
      console.log('Successfully reset all carbon data in Supabase');
      
      // Reset local state
      set({
        activities: [],
        carbonScore: null
      });
    } catch (error) {
      console.error('Error in resetScore:', error);
    } finally {
      set({ loading: false });
    }
  },
  
  loadSavedData: async (userId: string) => {
    if (!userId) {
      console.error('Cannot load saved data: No user ID provided');
      return;
    }
    
    try {
      set({ loading: true });
      console.log('Loading saved carbon data for user:', userId);
      
      // 1. Fetch the most recent carbon assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('carbon_assessments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (assessmentError && assessmentError.code !== 'PGRST116') {
        console.error('Error fetching assessment:', assessmentError);
        throw assessmentError;
      }
      
      if (!assessment) {
        console.log('No previous assessment found for user');
        set({ initialized: true, loading: false });
        return;
      }
      
      console.log('Found assessment:', assessment);
      
      // 2. Fetch activities for this assessment
      const { data: activities, error: activitiesError } = await supabase
        .from('carbon_activities')
        .select('*')
        .eq('assessment_id', assessment.id);
      
      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
        throw activitiesError;
      }
      
      console.log('Loaded activities:', activities);
      
      // 3. Fetch emissions data for this user
      const { data: emissions, error: emissionsError } = await supabase
        .from('emissions')
        .select('*')
        .eq('user_id', userId)
        .neq('type', 'total');
      
      if (emissionsError) {
        console.error('Error fetching emissions:', emissionsError);
        throw emissionsError;
      }
      
      console.log('Loaded emissions data:', emissions);
      
      // Reconstruct emission breakdown
      const emissionsBreakdown: Record<string, number> = {};
      emissions.forEach(emission => {
        emissionsBreakdown[emission.type] = emission.amount;
      });
      
      // Transform activities to match expected format
      const formattedActivities: Activity[] = activities.map(activity => ({
        id: activity.id || crypto.randomUUID(),
        sector: activity.sector,
        subsector: activity.subsector,
        activity_amount: activity.activity_amount,
        activity_unit: activity.activity_unit
      }));
      
      // Create a carbon score object from the data
      const carbonScore: CarbonScore = {
        total_emissions_tons_co2e: assessment.total_emissions,
        emissions_breakdown: emissionsBreakdown,
        carbon_rating: assessment.grade,
        rating_description: getRatingDescription(assessment.grade),
        recommendations: [],
        activity_details: formattedActivities.map(activity => ({
          sector: activity.sector,
          subsector: activity.subsector,
          amount: activity.activity_amount,
          emission_factor: 0, // We don't have this data stored
          emissions: 0 // We don't have this data stored
        }))
      };
      
      set({ 
        activities: formattedActivities, 
        carbonScore, 
        initialized: true,
        loading: false 
      });
      
      console.log('Successfully loaded saved carbon data');
    } catch (error) {
      console.error('Error loading carbon data:', error);
      set({ initialized: true, loading: false });
    }
  }
}));

// Helper function to generate rating description
function getRatingDescription(grade: string): string {
  switch(grade) {
    case 'A+': return 'Excellent';
    case 'A': return 'Very Good';
    case 'B': return 'Good';
    case 'C': return 'Average';
    case 'D': return 'Poor';
    case 'F': return 'Very Poor';
    default: return 'Not Rated';
  }
}