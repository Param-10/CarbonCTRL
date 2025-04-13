import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, MapPin, Phone, Mail, Calendar, BarChart3, AlertTriangle } from 'lucide-react';
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
          <p className="font-mono text-red-400 mb-6">{error}</p>
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
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-4xl font-bold text-white mb-2">Company Profile</h1>
        <p className="font-mono text-emerald-100/80">Manage your organization's details and view performance metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="feature-card lg:col-span-2 p-6"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-4 rounded-lg">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="font-space text-xl font-semibold text-white">Company Information</h2>
            </div>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="bg-emerald-800/90 px-6 py-2 rounded-lg font-mono text-sm hover:bg-emerald-700/90 border border-emerald-600/30 text-emerald-300"
            >
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </button>
          </div>

          {!isEditing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              <div className="space-y-6">
                <div>
                  <p className="font-mono text-sm text-emerald-100/70 mb-2">Company Name</p>
                  <p className="font-mono text-white text-lg">{companyData.name}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-emerald-300" />
                    <p className="font-mono text-sm text-emerald-100/70">Employees</p>
                  </div>
                  <p className="font-mono text-white text-lg">{companyData.employees}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-emerald-300" />
                    <p className="font-mono text-sm text-emerald-100/70">Location</p>
                  </div>
                  <p className="font-mono text-white text-lg">{companyData.location}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-emerald-300" />
                    <p className="font-mono text-sm text-emerald-100/70">Phone</p>
                  </div>
                  <p className="font-mono text-white text-lg">{companyData.phone}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-emerald-300" />
                    <p className="font-mono text-sm text-emerald-100/70">Email</p>
                  </div>
                  <p className="font-mono text-white text-lg">{companyData.email}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-emerald-300" />
                    <p className="font-mono text-sm text-emerald-100/70">Founded</p>
                  </div>
                  <p className="font-mono text-white text-lg">{companyData.founded}</p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2 mt-4">
                <p className="font-mono text-sm text-emerald-100/70">Industry</p>
                <p className="font-mono text-white">{companyData.industry}</p>
              </div>

              <div className="md:col-span-2 space-y-2 mt-2">
                <p className="font-mono text-sm text-emerald-100/70">Company Description</p>
                <p className="font-mono text-white leading-relaxed">{companyData.description}</p>
              </div>
            </div>
          )}

          {isEditing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">Company Name</label>
                <input
                  type="text"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Employees
                  </div>
                </label>
                <select
                  value={companyData.employees}
                  onChange={(e) => setCompanyData({ ...companyData, employees: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                >
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="250-500">250-500</option>
                  <option value="500+">500+</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location
                  </div>
                </label>
                <input
                  type="text"
                  value={companyData.location}
                  onChange={(e) => setCompanyData({ ...companyData, location: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </div>
                </label>
                <input
                  type="tel"
                  value={companyData.phone}
                  onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </div>
                </label>
                <input
                  type="email"
                  value={companyData.email}
                  onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Founded
                  </div>
                </label>
                <input
                  type="text"
                  value={companyData.founded}
                  onChange={(e) => setCompanyData({ ...companyData, founded: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">Company Description</label>
                <textarea
                  value={companyData.description}
                  onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono h-32"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">Industry</label>
                <select
                  value={companyData.industry}
                  onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
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
              </div>
            </div>
          )}
        </motion.div>

        {/* Carbon Stats Card */}
        {carbonScore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="feature-card p-6"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-emerald-500/20 p-4 rounded-lg">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="font-space text-xl font-semibold text-white">Carbon Stats</h2>
            </div>

            <div className="space-y-8">
              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-3">Total Emissions</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-space text-4xl font-bold text-white">
                    {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                  </span>
                  <span className="font-mono text-emerald-400 text-lg">tCO₂e</span>
                </div>
              </div>

              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-3">Carbon Rating</p>
                <div className="flex items-center gap-3">
                  <span className="font-space text-4xl font-bold text-white">
                    {carbonScore.carbon_rating}
                  </span>
                  <span className="font-mono text-emerald-400">
                    {carbonScore.rating_description}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CompanyProfilePage;