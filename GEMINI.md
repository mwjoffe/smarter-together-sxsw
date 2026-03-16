# Smarter Together 2026 - Project Status

## 🎨 Brand Identity
- **Primary Color:** Burnt Orange (`#C05C23`)
- **Secondary Color:** Pale Yellow (`#FDF19E`)
- **Background:** Charcoal/Black (`#0a0a0c`)
- **Typography:** System UI (Inter/Hanken Grotesk fallback)

## 🛠 Tech Stack
- **Framework:** React + Vite
- **Animations:** Framer Motion
- **3D Visualization:** React-Globe.gl + Three.js
- **Icons:** Custom SVGs (to ensure stability)

## 📍 Key Milestones Completed
1. **Interactive VAC Model (Slide 20):** Custom SVG implementation with animated axes and floating data points.
2. **Global Excitement Globe (Slide 37):** 3D spinning globe mapping Ipsos AI Monitor data to country geometries with hover tooltips.
3. **Speaker Intro:** Integrated local headshots from `/public/avatars/`.
4. **Auto-Scaling:** Implemented logic to ensure the 1440x900 canvas fits perfectly in any browser window.
5. **CASA Refinement (Slide 29):** Updated "Social Actor" terminology and corrected CASA definition.
6. **Algorithm Aversion Layout (Slide 31):** Optimized grid layout to display all analysis items on a single line.
7. **Cost of Seamless Automation (Slide 13):** Added a new slide emphasizing "Friction as a Feature" for high-stakes decisions.
8. **The Empathy Gap (Slide 22):** Added a new slide addressing the simulation of empathy vs. comprehension and Theory of Mind.

## ⚙️ Core Logic Updates
- **Conditional Layouts:** `App.tsx` contains ID-specific logic for grid layouts. Any further slide insertions require updating the `analysis` and `grid` type conditional blocks to ensure proper column counts (especially for IDs 13, 22, 29, 30, 31, and 32).
- **Slide Shifting:** The presentation now contains 40 slides. Slide IDs must be carefully maintained in the `slides` array to match the rendering logic.

## 🚀 Navigation
- **Next:** Right Arrow / Space
- **Back:** Left Arrow
- **Dev Server:** `npm run dev` (Runs on http://localhost:5173)
