import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Users, MapPin, Phone, Mail, Calendar, BarChart3 } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';

const CompanyProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const { carbonScore } = useCarbonStore();
  const [companyData, setCompanyData] = useState({
    name: 'EcoTech Solutions',
    employees: '250-500',
    location: 'San Francisco, CA',
    phone: '+1 (555) 123-4567',
    email: 'contact@ecotechsolutions.com',
    founded: '2015',
    industry: 'Technology',
    description: 'Leading provider of sustainable technology solutions, committed to reducing environmental impact through innovative software and services.',
  });

  const handleSave = () => {
    setIsEditing(false);
    // Here you would typically save to your backend
  };

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
          className="feature-card lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-4 rounded-lg">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="font-space text-xl font-semibold text-white">Company Information</h2>
            </div>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="glass-button px-4 py-2 rounded-lg font-mono text-sm"
            >
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">Company Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                ) : (
                  <p className="font-mono text-white">{companyData.name}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Employees
                  </div>
                </label>
                {isEditing ? (
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
                ) : (
                  <p className="font-mono text-white">{companyData.employees}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
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
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                ) : (
                  <p className="font-mono text-white">{companyData.location}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
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
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                ) : (
                  <p className="font-mono text-white">{companyData.phone}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
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
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                ) : (
                  <p className="font-mono text-white">{companyData.email}</p>
                )}
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">
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
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  />
                ) : (
                  <p className="font-mono text-white">{companyData.founded}</p>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block font-mono text-sm text-emerald-100/70 mb-2">Company Description</label>
              {isEditing ? (
                <textarea
                  value={companyData.description}
                  onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono h-32"
                />
              ) : (
                <p className="font-mono text-white">{companyData.description}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Card */}
        {carbonScore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="feature-card"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-emerald-500/20 p-4 rounded-lg">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="font-space text-xl font-semibold text-white">Carbon Stats</h2>
            </div>

            <div className="space-y-6">
              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-2">Total Emissions</p>
                <div className="flex items-baseline gap-2">
                  <span className="font-space text-3xl font-bold text-white">
                    {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                  </span>
                  <span className="font-mono text-emerald-400">tCO₂e</span>
                </div>
              </div>

              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-2">Carbon Rating</p>
                <div className="flex items-center gap-2">
                  <span className="font-space text-3xl font-bold text-white">
                    {carbonScore.carbon_rating}
                  </span>
                  <span className="font-mono text-emerald-400">{carbonScore.rating_description}</span>
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