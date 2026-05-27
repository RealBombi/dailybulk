# DailyBulk PRD

## Product Requirements Document

**Product name:** DailyBulk  
**Product type:** Mobile-first PWA fitness tracker  
**Main goal:** Help the user consistently track calories, protein, creatine, and bodyweight with a smooth, modern, home-screen-app experience.

---

## 1. Product Summary

DailyBulk is a modern, mobile-first fitness tracking web app that can be added to the phone home screen as a Progressive Web App (PWA).

The app should help the user stay consistent with:

- Daily calories
- Daily protein
- Daily creatine
- Bodyweight tracking
- Simple food logging
- Saved meals
- Food search through real food database APIs

The app must feel smooth, modern, fast, and satisfying to use. It should not feel like a large complicated fitness app. The main purpose is low friction: open app, see today’s status, add food, mark creatine, done.

---

## 2. Core Problem

The user struggles with:

- Remembering to take creatine every day
- Tracking calories consistently
- Tracking protein without making it too complicated
- Knowing whether they are on track for the day
- Staying motivated through visual progress

The app should solve this by making the most important actions extremely easy and visually rewarding.

---

## 3. Target User

Primary user:

- Young gym-focused user trying to bulk or gain weight
- Wants to track calories and creatine
- Dislikes boring logging apps
- Uses phone often
- Wants a website that can be added to the phone home screen like an app
- Likes smooth animations, circular progress UI, and modern dashboards

---

## 4. Product Goals

### Main Goals

1. Track daily calories.
2. Track daily protein.
3. Track daily creatine.
4. Track bodyweight over time.
5. Let users search food from real food databases.
6. Let users scan/search packaged foods where possible.
7. Let users save meals for fast repeat logging.
8. Make the user want to open the app daily.
9. Be installable as a PWA on mobile.
10. Feel modern, animated, and premium.

### Non-Goals for MVP

Do not build these in version 1:

- AI calorie estimation
- AI meal photo recognition
- Full social features
- Complex workout programming
- Meal plan generation
- Paid subscriptions
- App Store or Play Store release
- Full Apple Health / Google Fit integration
- Advanced nutrition coaching

---

## 5. Recommended Tech Stack

Use:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion or Motion
- Supabase for auth and database
- PWA manifest and service worker
- React Hook Form
- Zod
- Recharts or a simple chart library for weight trend charts

Allowed component libraries:

- Ali Imam components, especially Gauge
- Cult UI for animated shadcn-style cards/effects
- Watermelon UI for clean dashboard blocks
- Componentry for motion effects
- Dotmatrix for loading states
- Balloons JS for milestone celebrations only

---

## 6. Design Direction

The app should feel like:

- Dark mode first
- Smooth glassy dashboard
- Big circular progress indicators
- Minimal text
- Large tap targets
- Fast actions
- Subtle haptic-feeling animations
- Satisfying completion states

Visual style:

- Deep dark background, near-black or deep navy
- Rounded cards
- Soft borders
- Subtle blur
- Accent gradients
- Clean typography
- Large numbers
- Minimal labels
- Smooth animated state changes

Avoid:

- Too many charts
- Too much text
- Overcomplicated navigation
- Bright childish colors
- Fitness influencer-style UI
- Cluttered dashboards
- Too many forms

---

## 7. Main Dashboard

The dashboard is the most important page.

### Dashboard Must Show

1. **Calories Gauge**
   - Big circular gauge.
   - Example: `1850 / 3000 kcal`
   - Uses Ali Imam Gauge style.

2. **Protein Progress**
   - Smaller circular gauge or progress card.
   - Example: `96 / 145g`

3. **Creatine Status**
   - Big button/card:
     - `Creatine not taken`
     - `Mark as taken`
   - When completed:
     - Green check state
     - Optional small celebration animation

4. **Weight Quick Log**
   - Small card:
     - `Current weight`
     - `Log today's weight`

5. **Quick Add Food**
   - Main button:
     - `Add food`
   - Secondary options:
     - `Search food`
     - `Scan barcode`
     - `Saved meals`
     - `Quick add calories`

6. **Daily Status**
   - Simple dynamic message:
     - `You're on track`
     - `You need 900 kcal more`
     - `Protein is low today`
     - `Creatine done`

---

## 8. Gauge Component Requirement

Use this style for the calorie circle:

```tsx
"use client"

import { Gauge } from "@/registry/aliimam/components/gauge"

export function Component() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Gauge value={63} />
    </div>
  )
}
```

In the real app, the value should be calculated like this:

```ts
const caloriePercent = Math.min(
  Math.round((todayCalories / calorieGoal) * 100),
  100
)
```

The gauge should display:

- Percentage visually
- Current calories
- Goal calories
- Remaining calories

Example:

```tsx
<Gauge value={caloriePercent} />

<p>{todayCalories} / {calorieGoal} kcal</p>
<p>{calorieGoal - todayCalories} kcal remaining</p>
```

If the registry import does not work directly, copy the Gauge component into the project as a local component:

```tsx
import { Gauge } from "@/components/ui/gauge"
```

---

## 9. Pages and Navigation

Use bottom navigation on mobile.

### Pages

1. **Home**
   - Main daily dashboard

2. **Food**
   - Search food
   - Scan barcode
   - Saved meals
   - Manual add
   - Today’s food list

3. **Creatine**
   - Calendar view
   - Streak
   - Daily status

4. **Weight**
   - Weight log
   - Weekly average
   - Simple progress chart

5. **Settings**
   - Calorie goal
   - Protein goal
   - Creatine goal
   - Bodyweight unit
   - Theme/accent settings

---

## 10. Food Data Source

The app should use real food database APIs for calorie and nutrition data.

AI calorie estimation should not be included in the MVP.

### MVP Food Data Sources

Use:

1. **Open Food Facts API**
   - Used for barcode lookup
   - Used for packaged food products
   - Useful for grocery products
   - Should return product name, brand, serving size, calories, protein, carbs, fat, and barcode where available

2. **USDA FoodData Central API**
   - Used for generic food search
   - Used for foods like chicken, rice, eggs, oats, milk, banana, etc.
   - Requires an API key
   - Should return food name, calories, protein, carbs, fat, and serving/gram data where available

### Manual Fallback

If no API result is found, the user must be able to add food manually.

Manual fields:

```ts
name: string
calories: number
protein?: number
carbs?: number
fat?: number
servingSize?: string
```

### Saved Meals

Any API result or manual entry can be saved as a meal.

Example saved meals:

- Protein shake
- Chicken wrap
- Bread with cheese
- Milk
- Oats
- Pizza slice

Saved meals should store normalized nutrition values so the user can add them again quickly without needing to search the API every time.

---

## 11. Food Search UX

The Add Food page should have 4 modes:

1. Search food
2. Scan barcode
3. Saved meals
4. Manual add

### Search Food

Search should query USDA FoodData Central first for generic foods.

Example:

User searches:

```txt
chicken breast
```

App shows results such as:

- Chicken breast, cooked, 100g
- Chicken breast, raw, 100g
- Chicken breast, grilled, 100g

User selects one, enters amount in grams, and adds it.

### Scan Barcode

Barcode scan should query Open Food Facts.

Example:

User scans a protein milk barcode.

App shows:

- Product name
- Brand
- Calories per 100g/ml
- Protein per 100g/ml
- Carbs per 100g/ml
- Fat per 100g/ml

User selects serving size and adds it.

### Saved Meals

User sees their commonly used meals.

Example:

- Protein shake — 520 kcal / 45g protein
- Oats breakfast — 700 kcal / 35g protein
- Chicken wrap — 650 kcal / 42g protein

One tap adds the meal to today.

### Manual Add

If API data is missing or wrong, user can add the food manually.

---

## 12. Food API Abstraction

Create a clean abstraction layer:

```txt
/lib/food/providers/usda.ts
/lib/food/providers/open-food-facts.ts
/lib/food/normalize.ts
```

Normalize all API results into one internal format:

```ts
type NormalizedFood = {
  source: "usda" | "open_food_facts"
  externalId: string
  barcode?: string
  name: string
  brand?: string
  caloriesPer100g?: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
  servingSize?: string
  rawData: unknown
}
```

The frontend should not care whether the result came from USDA or Open Food Facts. It should only use `NormalizedFood`.

---

## 13. Food API Priority

Build food logging in this order:

1. Manual add
2. Saved meals
3. USDA search
4. Open Food Facts barcode lookup
5. Open Food Facts text search
6. Optional paid/pro APIs later if needed

Optional future APIs:

- FatSecret
- Nutritionix
- Spoonacular

These should not be required for MVP.

---

## 14. Creatine Tracker

Creatine tracking should be extremely simple.

### Requirements

- One button: `Took creatine`
- Once clicked, it marks today as complete
- User can undo if clicked by accident
- Show streak
- Show weekly completion
- Show calendar dots

### Completion Animation

When creatine is marked as taken:

- Button changes to green/check state
- Small animation plays
- Optional: use Balloons JS only for bigger milestones like 7-day streak, not every single click

---

## 15. Weight Tracking

### Requirements

- User can log bodyweight
- Show latest weight
- Show weekly average
- Show 7-day / 30-day trend
- Show whether weight is trending up, down, or stable

### Weight Chart

Keep it simple:

- Line chart
- No complicated analytics in MVP
- Focus on trend, not daily panic

---

## 16. Smooth UI and Component Ideas

### Use Ali Imam Gauge For

- Calories
- Protein
- Potentially water or creatine streak later

### Use Cult UI For

- Animated cards
- Hover/tap effects
- Bento dashboard blocks
- Glow/border effects

### Use Watermelon UI For

- Dashboard layout inspiration
- Clean production-style blocks
- Toasts or app shell components

### Use Componentry For

- Smooth text reveal
- Animated numbers
- Magnetic buttons
- Nice empty states

### Use Dotmatrix For

- Loading state when app opens
- Loading state during Supabase sync
- Skeleton replacement for dashboard loading

### Use Balloons JS For

- 7-day creatine streak
- First full calorie goal hit
- First full week completed
- New weight milestone

Do not overuse animations. The app should feel premium, not goofy.

---

## 17. Data Model

### users

```ts
type User = {
  id: string
  email: string
  createdAt: string
}
```

### user_settings

```ts
type UserSettings = {
  id: string
  userId: string
  calorieGoal: number
  proteinGoal: number
  creatineGoalGrams: number
  weightUnit: "kg" | "lbs"
  theme: "dark" | "light" | "system"
  accentColor: string
}
```

### food_entries

```ts
type FoodEntry = {
  id: string
  userId: string

  name: string
  brand?: string

  calories: number
  protein?: number
  carbs?: number
  fat?: number

  amount: number
  amountUnit: "g" | "ml" | "serving" | "piece"

  source: "manual" | "open_food_facts" | "usda" | "saved_meal"

  externalId?: string
  barcode?: string

  mealType?: "breakfast" | "lunch" | "dinner" | "snack" | "other"
  date: string
  createdAt: string
}
```

### saved_meals

```ts
type SavedMeal = {
  id: string
  userId: string
  name: string
  brand?: string

  calories: number
  protein?: number
  carbs?: number
  fat?: number

  amount: number
  amountUnit: "g" | "ml" | "serving" | "piece"

  source?: "manual" | "open_food_facts" | "usda"
  externalId?: string
  barcode?: string

  createdAt: string
}
```

### food_cache

```ts
type FoodCache = {
  id: string
  source: "open_food_facts" | "usda"
  externalId: string
  barcode?: string

  name: string
  brand?: string

  caloriesPer100g?: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number

  rawData: unknown
  updatedAt: string
}
```

### creatine_logs

```ts
type CreatineLog = {
  id: string
  userId: string
  date: string
  grams: number
  taken: boolean
  createdAt: string
}
```

### weight_logs

```ts
type WeightLog = {
  id: string
  userId: string
  date: string
  weight: number
  unit: "kg" | "lbs"
  createdAt: string
}
```

---

## 18. MVP User Stories

### Calories

As a user, I want to see a big calorie circle so I instantly know if I am on track.

As a user, I want to search foods from a database so I do not have to manually calculate everything.

As a user, I want to quick-add calories so I can log something fast when I do not care about details.

As a user, I want saved meals so I can log common meals in one tap.

### Protein

As a user, I want to track protein next to calories so I know if I am eating enough.

### Creatine

As a user, I want one button to mark creatine as taken.

As a user, I want to see my streak so I stay motivated.

### Weight

As a user, I want to log weight quickly.

As a user, I want to see my weekly trend instead of worrying about one bad day.

### PWA

As a user, I want to add the website to my home screen so it feels like an app.

---

## 19. PWA Requirements

The app must include:

- `manifest.json`
- App name
- App icons
- Theme color
- Mobile viewport
- Installable home-screen behavior
- Offline-friendly loading page
- App shell caching where possible

Suggested app name:

- DailyBulk

Other possible names:

- BulkBoard
- GainLog
- CreatineCheck
- MassTrack

---

## 20. Notifications and Reminders

For MVP, push notifications are optional.

Instead:

- Show reminder card on dashboard
- Add `Creatine not taken` status
- Add evening warning if calories are very low

Future reminders:

- Creatine reminder at chosen time
- Evening calorie reminder
- Morning weight reminder
- Browser push notifications

---

## 21. Empty States

### No Food Today

Message:

```txt
Nothing logged yet. Add your first meal.
```

Button:

```txt
Add food
```

### Creatine Not Taken

Message:

```txt
Not taken yet. One tap and you're done.
```

Button:

```txt
Mark as taken
```

### No Weight Logs

Message:

```txt
Log your first weight to start seeing your trend.
```

Button:

```txt
Log weight
```

---

## 22. UX Rules

The app must follow these UX rules:

1. Main actions should take maximum 1–2 taps.
2. Dashboard should load fast.
3. No page should feel like a spreadsheet.
4. Use big buttons.
5. Use animated numbers.
6. Use progress circles for motivation.
7. Use bottom navigation on mobile.
8. Avoid unnecessary forms.
9. Keep everything thumb-friendly.
10. Make success feel satisfying.
11. Always provide manual fallback if food API results are bad.
12. Let users save foods/meals after logging.

---

## 23. Acceptance Criteria

### Dashboard

- User can see calorie progress.
- User can see protein progress.
- User can mark creatine as taken.
- User can quick-add food.
- User can log weight.
- Gauge updates immediately after adding food.

### Food

- User can search food through USDA FoodData Central.
- User can scan or enter barcode through Open Food Facts.
- User can add food manually.
- User can quick-add calories.
- User can save a meal.
- User can add saved meal to today.
- User can delete wrong food entry.
- User can edit food entry amount.

### Creatine

- User can mark today complete.
- User can undo today.
- User can see streak.
- User can see weekly history.

### Weight

- User can log weight.
- User can see latest weight.
- User can see simple trend chart.

### PWA

- User can add app to home screen.
- App opens with app-like layout.
- App has icon and theme color.

---

## 24. Nice-To-Have Features After MVP

Add later:

1. AI food estimate from text
2. Meal templates
3. Weekly summary
4. Smart food suggestions
5. Streak achievements
6. Push reminders
7. Photo food logging
8. Workout tracker
9. Export data
10. Apple Health / Google Fit integration
11. Better barcode scanner
12. FatSecret/Nutritionix integration if Open Food Facts and USDA are not enough

---

## 25. Codex Build Prompt

Use this prompt to start implementation:

```txt
Build a mobile-first PWA called DailyBulk using Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, and Supabase.

The app is a simple calorie, protein, creatine, and weight tracker. It should feel smooth, modern, premium, dark-mode first, and installable to the phone home screen.

Use a large animated circular Gauge component for daily calorie progress. The design should be inspired by Ali Imam's Gauge component style. If the registry import does not work, create a local reusable Gauge component in /components/ui/gauge.tsx.

Main pages:
1. Home dashboard
2. Food logging
3. Creatine tracker
4. Weight tracker
5. Settings

Home dashboard must show:
- Big calorie gauge
- Protein progress
- Creatine status card with one-tap completion
- Weight quick log card
- Quick add food button
- Food search shortcut
- Barcode scan shortcut
- Saved meal shortcut
- Daily status message

Food data should come from real food database APIs, not AI estimation.

Implement food search using:
1. USDA FoodData Central API for generic food search.
2. Open Food Facts API for barcode and packaged food lookup.

Add an abstraction layer:
- /lib/food/providers/usda.ts
- /lib/food/providers/open-food-facts.ts
- /lib/food/normalize.ts

Normalize all API results into one internal format:

type NormalizedFood = {
  source: "usda" | "open_food_facts"
  externalId: string
  barcode?: string
  name: string
  brand?: string
  caloriesPer100g?: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
  servingSize?: string
  rawData: unknown
}

The Add Food page should have:
- Search food
- Scan barcode
- Saved meals
- Manual add

USDA should be used for generic searches like chicken, rice, eggs, oats, milk, banana, etc.

Open Food Facts should be used for barcode scanning and packaged foods.

If no result is found, the user must be able to manually add the food.

Any API result can be saved as a saved meal.

Store user food entries in Supabase. Store cached API results in a food_cache table to avoid unnecessary repeated API calls.

Creatine tracker must support:
- Mark today as taken
- Undo today
- Streak count
- Weekly completion view

Weight tracker must support:
- Add weight log
- Latest weight
- Simple 7-day/30-day trend chart

Use smooth animations for:
- Page transitions
- Number counting
- Gauge updates
- Button presses
- Completion states

Use modern cards, rounded corners, soft borders, subtle glow, and bottom mobile navigation.

Keep the app simple. Do not build AI food estimation, barcode AI recognition, social features, complex workout plans, or subscriptions in MVP.
```

---

## 26. Recommended MVP Build Order

1. Create app shell and PWA setup.
2. Build dark modern dashboard UI.
3. Add Supabase auth.
4. Add settings for calorie/protein goals.
5. Add manual food logging.
6. Add saved meals.
7. Add USDA food search.
8. Add Open Food Facts barcode lookup.
9. Add creatine tracker.
10. Add weight tracker.
11. Add animations and polish.
12. Test on mobile and add to home screen.

---

## 27. Final MVP Definition

The MVP is complete when the user can:

- Open the app from their phone home screen
- See daily calories and protein
- Add food manually
- Search food from a database
- Add packaged food through Open Food Facts/barcode lookup
- Save meals
- Mark creatine as taken
- Log weight
- See simple progress and trends
- Use the app without it feeling slow, ugly, or complicated
