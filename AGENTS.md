# Project Instructions: Spotter Weather-Aware Truck Routing

## Objective
Build the Spotter Full Stack Developer assessment: a React + Django application that analyzes three truck routes using time-aware weather forecasts and load-dependent safety rules.

## Required stack
- **Frontend**: React, Vite, JavaScript, Leaflet/React Leaflet, Tailwind CSS.
- **Backend**: Python, Django, Django REST Framework.
- **External services**: A routing API supporting alternative routes, geocoding where needed, and a weather API supporting hourly forecasts.

## Mandatory requirements
1. **Inputs**: origin, destination, departure date/time, truck load in pounds, and checkpoint sampling interval of 10, 25, or 50 miles.
2. **Alternative Routes**: Request up to three genuine alternative routes from the routing provider. Never fabricate or duplicate routes to reach three.
3. **Checkpoints**: Generate checkpoints along road geometry, including the route origin and destination.
4. **ETAs**: Estimate each checkpoint's arrival time using route distance and travel duration or segment durations.
5. **Weather Forecasts**: Retrieve forecast weather for each checkpoint's coordinates and estimated arrival time.
6. **Risk Classification**: Classify wind, rain and snow according to the assignment's thresholds.
7. **Load Rules**: Apply all load-dependent wind rules.
8. **Risk Metrics**: Calculate Severe miles, High miles, distance-weighted average risk and travel time.
9. **Recommendation Priority**: Recommend a route using this strict order:
   1. Fewest Severe miles
   2. Fewest High miles
   3. Lowest distance-weighted average risk
   4. Shortest travel time
10. **Ineligibility**: A route with a No Travel checkpoint is ineligible. If all routes are ineligible, clearly explain that no route meets the configured safety rules.
11. **Dashboard & Visualization**: Render route alternatives, checkpoint markers, risk details, route summaries and a 0–48-hour forecast slider.
12. **Resilience & UX**: Provide loading states, errors, input validation, unavailable-forecast handling and responsive design.

## Engineering rules
- Keep API integration, checkpoint generation, risk classification and route recommendation in separate modules.
- Keep all private API keys on the backend.
- Never present missing weather data as safe weather.
- Normalize weather units before risk classification.
- Do not use mock data in production or silently fall back to fake results.
- Use deterministic, testable business logic.
- Validate API responses and handle rate limits and provider failures.
- Avoid unnecessary dependencies and databases.
- Keep frontend and backend API contracts synchronized.
- Write tests for risk boundaries, load rules, checkpoint generation and route ranking.
- Use accessible labels, clear risk legends and responsive layouts.

## Workflow
Implement one phase at a time. Before editing, inspect the existing project and identify affected files. After each phase, run relevant tests and builds, fix failures, and summarize files changed, commands run, results and any remaining limitations. Never claim that a feature works without verifying it.

## Assessment priority
Prioritize correct routing, weather, risk and recommendation logic, followed by map/heatmap usability and performance. Avoid unrelated features.
