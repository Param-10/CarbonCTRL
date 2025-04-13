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
  addActivity: (activity: Omit<Activity, 'id'>) => void;
  removeActivity: (id: string) => void;
  calculateScore: () => Promise<void>;
  resetScore: () => void;
}

export const useCarbonStore = create<CarbonState>((set, get) => ({
  activities: [],
  carbonScore: null,
  loading: false,

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

  resetScore: () => {
    set({
      activities: [],
      carbonScore: null
    });
  }
}));