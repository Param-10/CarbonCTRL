import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, MapPin, Phone, Mail, Calendar, BarChart3, AlertTriangle, Save, Edit3 } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore, CompanyProfile } from '../store/companyStore';

const CompanyProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { carbonScore } = useCarbonStore();
  const { profile, loading, error, fetchProfile, updateProfile } = useCompanyStore();
  const [companyData, setCompanyData] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setCompanyData(profile);
    } else {
      // Empty company profile for new users - let them fill it out
      setCompanyData({
        name: "",
        employees: "1-10",
        location: "",
        phone: "",
        email: "",
        founded: "",
        industry: "",
        description: ""
      });
      // Start in editing mode if no profile exists
      setIsEditing(true);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!companyData) return;
    
    await updateProfile(companyData);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-emerald-100/70">Loading profile data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-lg">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="font-space text-xl font-bold text-white mb-2">Error Loading Profile</h2>
          <p className="font-mono text-red-400 mb-6">{error.message || String(error)}</p>
          <button 
            onClick={() => fetchProfile()} 
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!companyData) return null;

  return (
    <div className="fixed inset-0 md:left-64 overflow-y-auto bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800">
      <div className="px-8 py-8 space-y-10">
      {/* Welcome Message for New Users */}
      {!profile && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-lg flex-shrink-0">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white mb-2">
                Welcome to CarbonCTRL! 🌱
              </h2>
              <p className="font-mono text-emerald-100/90 leading-relaxed">
                Before we can help you track and reduce your carbon footprint, we need to know a bit about your organization. 
                Please fill out your company details below to get started on your sustainability journey!
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-mono text-emerald-300">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                <span>This helps us provide personalized carbon insights for your industry and size</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div>
        <h1 className="font-space text-4xl font-bold text-white mb-3">Company Profile</h1>
        <p className="font-mono text-emerald-100/80">
          {!profile 
            ? "Set up your organization's details to begin tracking your carbon impact"
            : "Manage your organization's details and view performance metrics"
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Company Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="feature-card lg:col-span-3 p-8 border border-emerald-500/20 shadow-xl rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/30">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-space text-xl font-semibold text-white">Company Information</h2>
                <p className="font-mono text-sm text-emerald-100/60 mt-1">Fill out your organization details</p>
              </div>
            </div>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className={`glass-button px-6 py-3 rounded-xl font-mono text-sm flex items-center gap-2 transition-all ${
                isEditing 
                  ? 'bg-emerald-500/40 hover:bg-emerald-500/50 text-white' 
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
              }`}
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4" />
                  {!profile ? 'Complete Setup & Continue' : 'Save Changes'}
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-3">Company Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                    placeholder="Enter your company name"
                    className="w-full bg-gray-800/40 border-2 border-emerald-500/20 rounded-xl py-3 px-5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 font-mono shadow-inner transition-all duration-200"
                  />
                ) : (
                  <div className="w-full bg-gray-800/20 border border-gray-700/30 rounded-xl py-3 px-5 text-white font-mono min-h-[48px] flex items-center">
                    {companyData.name || 'Not specified'}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Employees
                  </div>
                </label>
                {isEditing ? (
                  <select
                    value={companyData.employees}
                    onChange={(e) => setCompanyData({ ...companyData, employees: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  >
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="250-500">250-500</option>
                    <option value="500+">500+</option>
                  </select>
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.employees}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </div>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.location}
                    onChange={(e) => setCompanyData({ ...companyData, location: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.location}</p>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </div>
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.phone}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </div>
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.email}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Founded
                  </div>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.founded}
                    onChange={(e) => setCompanyData({ ...companyData, founded: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.founded}</p>
                )}
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <label className="block font-mono text-sm text-emerald-100/70 mb-3">Company Description</label>
              {isEditing ? (
                <textarea
                  value={companyData.description}
                  onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                  className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner h-40"
                />
              ) : (
                <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30 min-h-[6rem] leading-relaxed">{companyData.description}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-3 mb-4">
              <label className="block font-mono text-sm text-emerald-100/70 mb-3">Industry</label>
              {isEditing ? (
                <select
                  value={companyData.industry}
                  onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                  className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                >
                  <option value="Technology">Technology</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Energy">Energy</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Financial Services">Financial Services</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Retail">Retail</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Education">Education</option>
                  <option value="Construction">Construction</option>
                </select>
              ) : (
                <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.industry}</p>
              )}
            </div>
            
            {/* Motivational message for new users */}
            {!profile && isEditing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🚀</span>
                  <h3 className="font-space text-lg font-semibold text-white">Almost there!</h3>
                </div>
                <p className="font-mono text-sm text-emerald-300 leading-relaxed">
                  Complete your company setup to unlock carbon tracking, AI-powered insights, and personalized recommendations. 
                  <br />
                  <span className="text-emerald-400 font-semibold">Let's help you reduce your carbon footprint together! 🌱</span>
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Quick Stats Card */}
        {carbonScore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="feature-card p-6 border border-emerald-500/20 shadow-xl rounded-2xl bg-gradient-to-br from-emerald-900/20 to-blue-900/20 backdrop-blur-sm"
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-500/20 p-5 rounded-xl">
                <BarChart3 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="font-space text-2xl font-semibold text-white">Carbon Stats</h2>
            </div>

            <div className="space-y-8">
              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-3">Total Emissions</p>
                <div className="flex items-baseline gap-2 bg-gray-800/30 p-5 rounded-xl border border-gray-700/30">
                  <span className="font-space text-3xl font-bold text-white">
                    {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                  </span>
                  <span className="font-mono text-emerald-400">tCO₂e</span>
                </div>
              </div>

              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-3">Carbon Rating</p>
                <div className="flex items-center justify-between gap-2 bg-gray-800/30 p-5 rounded-xl border border-gray-700/30">
                  <span className="font-space text-3xl font-bold text-white">
                    {carbonScore.carbon_rating}
                  </span>
                  <span className="font-mono text-emerald-400">Rating</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
};

export default CompanyProfilePage;