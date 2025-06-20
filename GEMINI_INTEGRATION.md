# Enhanced Gemini AI Integration for CarbonCTRL

## Overview

CarbonCTRL now features a sophisticated AI-powered recommendation system using Google's Gemini 2.5 Flash model. The system provides highly personalized, industry-specific carbon reduction recommendations based on comprehensive company data and emission profiles.

## Features

### 🚀 Gemini 2.5 Flash Enhancements
- **Enhanced reasoning capabilities**: Superior context understanding and multi-factor analysis
- **Improved JSON consistency**: More reliable structured responses with complex data
- **Advanced prompt handling**: Better processing of sophisticated prompts with multiple requirements
- **Reduced hallucination**: Improved factual accuracy and grounded recommendations
- **Complex scenario analysis**: Enhanced ability to handle multi-constraint optimization problems

### 🎯 Enhanced Personalization
- **Industry-specific insights**: Tailored recommendations for Technology, Financial Services, Manufacturing, and other sectors
- **Company size adjustments**: Cost estimates and timelines adapted to company scale (startup vs enterprise)
- **Location-aware calculations**: ROI and incentive considerations based on geographic location
- **Emission source prioritization**: Data-driven focus on highest-impact areas

### 📊 Advanced Analytics
- **Impact calculations**: Precise CO₂e reduction estimates tied to actual emission data
- **ROI analysis**: Expected payback periods for each recommendation
- **Priority framework**: High/Medium/Low priority rankings based on impact vs effort
- **Summary statistics**: Total potential reduction, quick wins vs strategic initiatives

### 🛡️ Robust Fallback System
- **Enhanced fallback recommendations**: Intelligent recommendations even when AI is unavailable
- **Industry-specific fallbacks**: Contextual recommendations based on company profile
- **Data-driven calculations**: Impact estimates based on actual emission breakdowns

## Setup Instructions

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment Variables

Create a `.env` file in the `server` directory with the following:

```env
# MongoDB Configuration
MONGODB_URI=your-mongodb-connection-string

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key

# API Configuration
NODE_ENV=development
PORT=5000

# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### 3. Test the Integration

The system automatically detects if a valid Gemini API key is available:

- **With valid API key**: Uses Gemini 2.5 Flash for advanced AI recommendations
- **Without API key**: Uses enhanced fallback system with intelligent recommendations

### 4. Test Gemini 2.5 Flash Capabilities

Run the enhanced test script to verify Gemini 2.5 Flash functionality:

```bash
# Add your API key to the test file first
node test-gemini-2.5.js
```

This test validates:
- Basic connectivity and model configuration
- Enhanced carbon recommendation generation
- Complex multi-context scenario analysis
- JSON response consistency and structure
- Advanced reasoning capabilities

## API Endpoints

### Test Gemini Connection
```
GET /api/gemini/test
```
Tests if Gemini AI is properly configured and working.

### Get Carbon Recommendations
```
POST /api/gemini/carbon-recommendations
```

**Request Body:**
```json
{
  "industry": "Technology",
  "emissions_data": {
    "total_emissions_tons_co2e": 45.8,
    "carbon_rating": "B",
    "breakdown": {
      "Energy": 28.5,
      "Transportation": 12.3,
      "Waste Management": 5.0
    }
  },
  "selected_sectors": ["Energy", "Transportation"]
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "title": "Smart Energy Management for Technology Companies",
      "description": "Implement an automated energy management system...",
      "impact": 10.0,
      "timeline": "3-6 months",
      "cost": "Medium",
      "roi_months": 18,
      "priority": "High",
      "industry_specific": "Technology companies can leverage IoT sensors..."
    }
  ],
  "summary": {
    "total_potential_reduction": 44.1,
    "quick_wins_count": 1,
    "strategic_initiatives_count": 3,
    "estimated_total_investment": "Medium to High",
    "payback_period": "12-24 months"
  }
}
```

## Enhanced Prompt Structure

The system uses a comprehensive prompt that includes:

### Company Context
- Company name, industry, size, location
- Founding year and business description
- Employee count for scaling recommendations

### Carbon Footprint Analysis
- Total emissions with performance benchmarking
- Detailed emissions breakdown by sector
- Current carbon rating and improvement potential

### User Preferences
- Selected focus sectors for targeted recommendations
- Specific activities and emission sources

### Requirements Framework
1. Emission source prioritization
2. Industry-specific considerations
3. Company size and location feasibility
4. Quick wins vs strategic initiatives balance
5. Regulatory and best practice alignment
6. Clear ROI and implementation guidance

## Industry-Specific Features

### Technology Companies
- Cloud infrastructure optimization
- Sustainable software development practices
- Remote work and digital collaboration
- IoT-based energy management

### Financial Services
- Digital-first operations
- Paperless transformation
- ESG compliance strategies
- Stakeholder reporting automation

### Manufacturing
- Process optimization
- Energy recovery systems
- Lean manufacturing principles
- Supply chain sustainability

### General Recommendations
- Employee engagement programs
- Renewable energy transitions
- Electric fleet management
- Waste reduction initiatives

## Frontend Integration

The recommendations page (`src/pages/RecommendationsPage.tsx`) includes:

### Enhanced UI Features
- **AI Status Indicator**: Shows Gemini connection status
- **Test AI Button**: Allows users to verify AI functionality
- **Priority Badges**: Visual priority indicators (High/Medium/Low)
- **Industry Insights**: Dedicated sections for industry-specific information
- **Summary Analytics**: Overview of potential impact and investment levels

### Interactive Elements
- **Sector Selection**: Users can focus on specific emission sectors
- **Regenerate Button**: Request new recommendations with different parameters
- **Impact Visualization**: Percentage reduction potential and cost analysis

## Best Practices

### Prompt Engineering
1. **Specificity**: Include detailed company context and emission data
2. **Structure**: Use clear sections and requirements
3. **Constraints**: Define cost levels, timelines, and priority frameworks
4. **Format**: Request structured JSON responses for consistency

### Error Handling
1. **API Validation**: Verify API key format and validity
2. **Response Parsing**: Handle malformed JSON gracefully
3. **Fallback Logic**: Provide intelligent alternatives when AI fails
4. **User Feedback**: Clear error messages and status indicators

### Performance Optimization
1. **Caching**: Consider caching recommendations for similar profiles
2. **Rate Limiting**: Respect Gemini API usage limits
3. **Async Processing**: Handle long AI response times gracefully
4. **Progressive Enhancement**: Fallback system ensures functionality

## Troubleshooting

### Common Issues

**Invalid API Key**
- Verify key is correctly formatted
- Check API key permissions in Google AI Studio
- Ensure key is properly set in environment variables

**Rate Limiting**
- Monitor API usage in Google AI Studio
- Implement request queuing for high-traffic scenarios
- Consider upgrading to paid tier for higher limits

**JSON Parsing Errors**
- Review prompt structure for clarity
- Test with different temperature settings
- Implement robust fallback parsing logic

### Testing Commands

Test the enhanced recommendations system:
```bash
# Start the backend server
cd server && npm start

# In another terminal, test the frontend
npm run dev

# Navigate to /recommendations and use the "Test AI" button
```

## Future Enhancements

### Planned Features
1. **Multi-model Support**: Integration with other AI providers
2. **Custom Training**: Fine-tuning on industry-specific data
3. **Real-time Updates**: Dynamic recommendations based on latest data
4. **Collaborative Filtering**: Recommendations based on similar companies

### Advanced Capabilities
1. **Regulatory Intelligence**: Auto-updated compliance requirements
2. **Market Analysis**: Cost trends and technology forecasts
3. **Impact Modeling**: Detailed scenario analysis and projections
4. **Integration APIs**: Connect with external carbon tracking tools

## Conclusion

The enhanced Gemini integration transforms CarbonCTRL from a basic carbon tracking tool into an intelligent sustainability advisor. With sophisticated personalization, industry-specific insights, and robust fallback systems, users receive actionable recommendations tailored to their unique business context and emission profile.

The system is designed to be both powerful when AI is available and functional when it's not, ensuring consistent user experience regardless of external dependencies. 