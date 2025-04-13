# CarbonCTRL

<p align="center">
  <b>Smart carbon management for forward-thinking businesses</b>
</p>

## 🌍 Overview

CarbonCTRL is a comprehensive carbon management platform that helps businesses track, reduce, and offset their carbon emissions. With advanced AI-powered recommendations and real-world offset project suggestions, CarbonCTRL makes sustainable business practices accessible and actionable.

### Key Features

•⁠  ⁠*Carbon Assessment*: Complete evaluation of your company's carbon footprint
•⁠  ⁠*AI-Powered Recommendations*: Smart, tailored suggestions to reduce emissions
•⁠  ⁠*Real-World Offset Projects*: Gemini AI-researched carbon offset opportunities
•⁠  ⁠*Interactive Dashboard*: Visualize your carbon journey with real-time metrics
•⁠  ⁠*Company Profile Management*: Track your sustainability progress over time

## 🚀 Getting Started

### Prerequisites

•⁠  ⁠Node.js (v16+)
•⁠  ⁠npm or yarn
•⁠  ⁠Supabase account (for authentication and data storage)
•⁠  ⁠Google Gemini API key (for AI-powered features)

### Installation

1.⁠ ⁠Clone the repository:
   ⁠ bash
   git clone https://github.com/yParam-10/carbonctrl.git
   cd carbonctrl
    ⁠

2.⁠ ⁠Install dependencies:
   ⁠ bash
   npm install
    ⁠

3.⁠ ⁠Set up environment variables:
   Create a ⁠ .env ⁠ file in the root directory with the following:
   
⁠    VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
    ⁠

4.⁠ ⁠Start the development server:
   ⁠ bash
   npm run dev
    ⁠

5.⁠ ⁠Open your browser and navigate to ⁠ http://localhost:5173 ⁠ (or the port shown in your terminal)

## ✨ Features In Detail

### Carbon Assessment

Track your company's carbon emissions across multiple categories:
•⁠  ⁠Energy consumption
•⁠  ⁠Transportation
•⁠  ⁠Supply chain
•⁠  ⁠Waste management
•⁠  ⁠Employee commuting
•⁠  ⁠Business travel

### AI-Powered Recommendations

Receive personalized recommendations to reduce your carbon footprint, powered by Google's Gemini AI. Recommendations include:
•⁠  ⁠Estimated impact
•⁠  ⁠Implementation timeline
•⁠  ⁠Potential cost savings
•⁠  ⁠Available tax benefits and incentives

### Carbon Offset Projects

Discover real-world offset opportunities that match your company's profile:
•⁠  ⁠Projects researched in real-time using Gemini AI
•⁠  ⁠Detailed project information and implementation guidance
•⁠  ⁠Direct links to participation opportunities
•⁠  ⁠Sector-specific alignment with your business

## 🔧 Advanced Usage

### Local Storage Caching

CarbonCTRL includes an intelligent caching system for offset projects, which:
•⁠  ⁠Stores data locally for 24 hours
•⁠  ⁠Significantly improves page load performance
•⁠  ⁠Reduces API usage and costs
•⁠  ⁠Provides offline capabilities

To clear the cache:
⁠ javascript
// In the browser console
window.localStorage.removeItem('carbon-offset-storage')
 ⁠

### Custom Deployment

To deploy CarbonCTRL to your own infrastructure:

1.⁠ ⁠Build the project:
   ⁠ bash
   npm run build
    ⁠

2.⁠ ⁠The ⁠ dist ⁠ folder will contain all necessary assets for deployment.

3.⁠ ⁠For Netlify deployment, include the ⁠ _redirects ⁠ file:
   
⁠    /* /index.html 200
    ⁠

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.⁠ ⁠Fork the repository
2.⁠ ⁠Create your feature branch (⁠ git checkout -b feature/amazing-feature ⁠)
3.⁠ ⁠Commit your changes (⁠ git commit -m 'Add some amazing feature' ⁠)
4.⁠ ⁠Push to the branch (⁠ git push origin feature/amazing-feature ⁠)
5.⁠ ⁠Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

•⁠  ⁠[Supabase](https://supabase.io/) for authentication and database
•⁠  ⁠[Google Gemini AI](https://ai.google/discover/generativeai/) for AI-powered recommendations
•⁠  ⁠[React](https://reactjs.org/) and [Vite](https://vitejs.dev/) for the frontend framework
•⁠  ⁠[Zustand](https://github.com/pmndrs/zustand) for state management
•⁠  ⁠[Tailwind CSS](https://tailwindcss.com/) for styling
•⁠  ⁠[Framer Motion](https://www.framer.com/motion/) for animations

---

<p align="center">
  Made with 💚 for a greener future
</p>
