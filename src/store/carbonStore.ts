import { create } from 'zustand';
import { apiClient } from '../lib/api';

interface CarbonActivity {
  id?: string;
  _id?: string;
  sector: string;
  subsector: string;
  activityAmount: number;
  activityUnit: string;
}

interface CarbonScore {
  total_emissions_tons_co2e: number;
  carbon_rating: string;
  emissions_breakdown: Record<string, number>;
  improvement_potential: number;
  benchmark_comparison: string;
}

interface CarbonState {
  activities: CarbonActivity[];
  carbonScore: CarbonScore | null;
  loading: boolean;
  initialized: boolean;
  addActivity: (activity: Omit<CarbonActivity, 'id' | '_id'>, userId: string) => Promise<void>;
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
      
      const newActivity = await apiClient.addActivity({
        sector: activity.sector,
        subsector: activity.subsector,
        activityAmount: activity.activityAmount,
        activityUnit: activity.activityUnit
      });
      
      console.log('Successfully added activity');
      
      // Update local state
      set(state => ({
        activities: [...state.activities, { ...newActivity, id: newActivity._id }]
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
      
      await apiClient.deleteActivity(id);
      
      console.log('Successfully removed activity');
      
      // Update local state
      set(state => ({
        activities: state.activities.filter(activity => activity.id !== id && activity._id !== id)
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
      
      const result = await apiClient.calculateCarbonScore({
        company_name: "User Company",
        activities: activities.map(({ sector, subsector, activityAmount, activityUnit }) => ({
          sector,
          subsector,
          activity_amount: activityAmount,
          activity_unit: activityUnit
        }))
      });

      console.log('Received carbon score result:', result);
      
      set({ carbonScore: result });
      
      // Update assessment with new score
      const assessment = await apiClient.getAssessment();
      if (assessment) {
        await apiClient.updateAssessment(assessment._id, {
          totalEmissions: result.total_emissions_tons_co2e,
          grade: result.carbon_rating,
          emissionsBreakdown: result.emissions_breakdown
        });
        
        console.log('Updated assessment with new score');
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
      
      await apiClient.resetCarbonData();
      
      console.log('Successfully reset all carbon data');
      
      // Reset local state
      set({
        activities: [],
        carbonScore: null,
        initialized: false
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
      
      const savedData = await apiClient.getSavedData();
      
      if (!savedData.assessment) {
        console.log('No previous assessment found for user');
        set({ initialized: true, loading: false });
        return;
      }
      
      console.log('Found assessment:', savedData.assessment);
      
      // Process activities to include id field for compatibility
      const activities = savedData.activities.map((activity: unknown) => {
        const act = activity as Record<string, unknown>;
        return {
          ...act,
          id: act._id,
          activityAmount: act.activityAmount
        };
      });
      
      console.log('Loaded activities:', activities);
      
      // Build carbon score from assessment and emissions
      const emissionsBreakdown: Record<string, number> = {};
      savedData.emissions.forEach((emission: unknown) => {
        const em = emission as Record<string, unknown>;
        emissionsBreakdown[em.type as string] = em.amount as number;
      });
      
      const carbonScore: CarbonScore = {
        total_emissions_tons_co2e: savedData.assessment.totalEmissions,
        carbon_rating: savedData.assessment.grade,
        emissions_breakdown: emissionsBreakdown,
        improvement_potential: Math.max(0, savedData.assessment.totalEmissions * 0.3),
        benchmark_comparison: savedData.assessment.totalEmissions > 50 ? 'Above average' : 'Below average'
      };
      
      // Update state with loaded data
      set({
        activities,
        carbonScore,
        initialized: true,
        loading: false
      });
      
      console.log('Successfully loaded saved carbon data');
    } catch (error) {
      console.error('Error loading carbon data:', error);
    } finally {
      set({ loading: false });
    }
  }
}));