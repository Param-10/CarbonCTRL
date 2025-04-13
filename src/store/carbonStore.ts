import { create } from 'zustand';

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
  addActivity: (activity: Omit<Activity, 'id'>) => void;
  removeActivity: (id: string) => void;
  calculateScore: () => Promise<void>;
  resetScore: () => void;
  saveResults: (userId: string) => Promise<void>;
  loadSavedData: (userId: string) => Promise<void>;
}

export const useCarbonStore = create<CarbonState>((set, get) => ({
  activities: [],
  carbonScore: null,
  loading: false,
  initialized: false,

  addActivity: (activity) => {
    const id = crypto.randomUUID();
    set((state) => ({
      activities: [...state.activities, { ...activity, id }]
    }));
  },

  removeActivity: (id) => {
    set((state) => ({
      activities: state.activities.filter((activity) => activity.id !== id)
    }));
  },

  calculateScore: async () => {
    const { activities } = get();
    
    if (activities.length === 0) {
      return;
    }

    set({ loading: true });

    try {
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
        throw new Error('Failed to calculate carbon score');
      }

      const result = await response.json();
      set({ carbonScore: result });
    } catch (error) {
      console.error('Error calculating carbon score:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  saveResults: async (userId: string) => {
    const { carbonScore, activities } = get();
    
    if (!carbonScore || activities.length === 0) {
      console.error('No carbon score or activities to save');
      return;
    }

    try {
      set({ loading: true });
      
      // Import supabase client
      const { supabase } = await import('../lib/supabase');
      
      // 1. Save the overall assessment
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('carbon_assessments')
        .insert({
          user_id: userId,
          total_emissions: carbonScore.total_emissions_tons_co2e,
          grade: carbonScore.carbon_rating
        })
        .select('id')
        .single();

      if (assessmentError) {
        throw new Error(`Failed to save assessment: ${assessmentError.message}`);
      }

      const assessmentId = assessmentData.id;
      
      // 2. Save the individual activities
      const activitiesWithAssessmentId = activities.map(activity => ({
        assessment_id: assessmentId,
        sector: activity.sector,
        subsector: activity.subsector,
        activity_amount: activity.activity_amount,
        activity_unit: activity.activity_unit
      }));
      
      const { error: activitiesError } = await supabase
        .from('carbon_activities')
        .insert(activitiesWithAssessmentId);
      
      if (activitiesError) {
        throw new Error(`Failed to save activities: ${activitiesError.message}`);
      }
      
      // 3. Save emissions data to the emissions table
      // For each emission type, create a separate record
      const emissionEntries = Object.entries(carbonScore.emissions_breakdown).map(([type, amount]) => ({
        user_id: userId,
        type,
        amount
      }));
      
      // Add a record for the total emissions as well
      emissionEntries.push({
        user_id: userId,
        type: 'total',
        amount: carbonScore.total_emissions_tons_co2e
      });
      
      const { error: emissionsError } = await supabase
        .from('emissions')
        .insert(emissionEntries);
      
      if (emissionsError) {
        throw new Error(`Failed to save emissions: ${emissionsError.message}`);
      }
      
      console.log('Successfully saved assessment, activities, and emissions data');
    } catch (error) {
      console.error('Error saving carbon data:', error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  resetScore: () => {
    set({
      activities: [],
      carbonScore: null
    });
  },
  
  loadSavedData: async (userId: string) => {
    if (!userId) return;
    
    try {
      set({ loading: true });
      
      const { supabase } = await import('../lib/supabase');
      
      // 1. Fetch the most recent carbon assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('carbon_assessments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (assessmentError && assessmentError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch assessment: ${assessmentError.message}`);
      }
      
      if (!assessment) {
        // No previous assessment found
        set({ initialized: true, loading: false });
        return;
      }
      
      // 2. Fetch activities for this assessment
      const { data: activities, error: activitiesError } = await supabase
        .from('carbon_activities')
        .select('*')
        .eq('assessment_id', assessment.id);
      
      if (activitiesError) {
        throw new Error(`Failed to fetch activities: ${activitiesError.message}`);
      }
      
      // 3. Fetch emissions data for this user
      const { data: emissions, error: emissionsError } = await supabase
        .from('emissions')
        .select('*')
        .eq('user_id', userId)
        .neq('type', 'total');
      
      if (emissionsError) {
        throw new Error(`Failed to fetch emissions: ${emissionsError.message}`);
      }
      
      // Reconstruct emission breakdown
      const emissionsBreakdown: Record<string, number> = {};
      emissions.forEach(emission => {
        emissionsBreakdown[emission.type] = emission.amount;
      });
      
      // Transform activities to match expected format
      const formattedActivities: Activity[] = activities.map(activity => ({
        id: crypto.randomUUID(), // Generate new IDs for client-side management
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